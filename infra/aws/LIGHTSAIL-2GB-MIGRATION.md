# Lightsail API 2 GB migration

This runbook moves the production API from `dc-react-api-lightsail` to the
snapshot-created `dc-react-api-lightsail-2gb` without replacing the original
instance. CloudFormation continues to own the existing static IP, CPU alarm,
database, buckets, IAM resources, and secrets. Never change the legacy
`InstanceBundleId`: Lightsail does not support an in-place bundle update, and
the CloudFormation instance resource cannot create from a snapshot.

Nothing here is automatic. Run each phase separately, inspect its checkpoint,
and stop on any mismatch. Use AWS CLI v2 and `jq` from a trusted administrator
session in `ap-south-1`.

## State model

| `ApiGenerationMode` | Stack-managed instances | Static IP / CPU alarm | Purpose |
| --- | --- | --- | --- |
| `legacy` | legacy only | legacy | Before migration |
| `dual-legacy` | legacy and 2 GB | legacy | Candidate validation or rollback |
| `dual-2gb` | legacy and 2 GB | 2 GB | Cutover with rollback available |
| `2gb` | 2 GB only | 2 GB | Final state after rollback expires |

Never move from a dual mode back to `legacy`. `ApiInstance2Gb` is retained on
removal, so that transition would orphan it; rollback is `dual-legacy`.

The normal deployment workflow deliberately has no migration-mode input. AWS
CLI `cloudformation deploy` preserves omitted parameters on an existing stack,
so routine `update_infrastructure=true` runs preserve `ApiGenerationMode` and
`Api2GbBundleId`. The workflow also rejects a non-legacy mode unless the
stack-managed candidate is running with the recorded bundle, 2 GB RAM, two
vCPUs, Ubuntu 24.04, and Availability Zone `ap-south-1a`.

## Fixed names and prerequisites

```bash
export AWS_REGION=ap-south-1
export AWS_PAGER=''
export STACK_NAME=dc-react-lightsail-production
export LEGACY_NAME=dc-react-api-lightsail
export CANDIDATE_NAME=dc-react-api-lightsail-2gb
export STATIC_IP_NAME=dc-react-api-ip
export TEMPLATE=infra/aws/lightsail-production.yaml
export IMPORT_MAP=infra/aws/lightsail-2gb-import-resources.json
```

Before snapshotting, work from the reviewed commit containing this template,
confirm a current managed-MySQL backup, arrange a maintenance/rollback window,
and confirm the operator can create Lightsail snapshots/instances, import and
update CloudFormation resources, and inspect CloudWatch. Do not combine this
migration with application, database, IAM, secret, bucket, CDN, SES, or budget
changes.

Read-only preflight:

```bash
aws cloudformation validate-template --template-body "file://$TEMPLATE" >/dev/null
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' --output text)
case "$STACK_STATUS" in
  CREATE_COMPLETE|UPDATE_COMPLETE|IMPORT_COMPLETE) ;;
  *) echo "Stack is not stable: $STACK_STATUS"; exit 1 ;;
esac

CURRENT_MODE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Parameters[?ParameterKey=='ApiGenerationMode'].ParameterValue | [0]" \
  --output text)
if [ -z "$CURRENT_MODE" ] || [ "$CURRENT_MODE" = None ]; then CURRENT_MODE=legacy; fi
test "$CURRENT_MODE" = legacy
test "$(aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" \
  --query 'staticIp.attachedTo' --output text)" = "$LEGACY_NAME"

if aws lightsail get-instance --instance-name "$CANDIDATE_NAME" >/dev/null 2>&1; then
  echo "$CANDIDATE_NAME already exists; identify its ownership first."
  exit 1
fi

aws cloudformation get-template-summary --template-body "file://$TEMPLATE" \
  --query "ResourceIdentifierSummaries[?ResourceType=='AWS::Lightsail::Instance']"
```

The last command must list `InstanceName` as an import identifier. The committed
mapping names exactly one logical and physical resource. Also retain the live
original template for comparison; an import change set must not carry any
unrelated update to an existing resource:

```bash
aws cloudformation get-template --stack-name "$STACK_NAME" \
  --template-stage Original --query TemplateBody --output text \
  >/tmp/dc-react-live-template-before-2gb.yaml
test -s /tmp/dc-react-live-template-before-2gb.yaml
```

## 1. Select the live 2 GB Linux bundle

Do not copy a historical bundle ID. List current active plans, choose the one
Linux/Unix plan with 2 GB RAM and two vCPUs, and validate the exact ID:

```bash
aws lightsail get-bundles --include-inactive --output json \
  | jq -r '.bundles[]
    | select(.isActive == true and .ramSizeInGb == 2 and .cpuCount == 2)
    | select(.supportedPlatforms | index("LINUX_UNIX"))
    | [.bundleId, .cpuCount, .ramSizeInGb, .price, (.supportedPlatforms | join(","))]
    | @tsv'

export API_2GB_BUNDLE_ID='REPLACE_WITH_REVIEWED_ACTIVE_BUNDLE_ID'
aws lightsail get-bundles --include-inactive --output json \
  | jq -e --arg bundle "$API_2GB_BUNDLE_ID" '
      [.bundles[] | select(
        .bundleId == $bundle and .isActive == true
        and .ramSizeInGb == 2 and .cpuCount == 2
        and (.supportedPlatforms | index("LINUX_UNIX")))] | length == 1' >/dev/null
```

Record the returned monthly price. With the current plans, overlap is about
USD 19/month prorated for instances (USD 7 + USD 12), plus snapshot storage.
After deleting legacy, the instance is about USD 12/month, a net USD 5/month
increase. Recheck prices at execution time. The unchanged USD 25 whole-stack
budget is expected to alert during overlap and may alert after cutover.

## 2. Create a worker-safe snapshot and candidate

The cloned disk has `RUN_BACKGROUND_WORKERS=yes` and a saved root PM2 process.
If both clones boot normally, scheduled/outbox work can run twice against the
shared MySQL database. Before the snapshot, disable PM2 autostart on legacy
without stopping the live process:

```bash
sudo systemctl disable pm2-root
test "$(sudo systemctl is-enabled pm2-root || true)" = disabled
pm2 describe dc-react-api >/dev/null
curl -fsS http://127.0.0.1:8787/health | jq -e '.ok == true' >/dev/null
```

Keep that SSH session open. Create the snapshot and wait. Re-enable legacy PM2
autostart immediately after it becomes available, even if a later step fails:

```bash
export SNAPSHOT_NAME="dc-react-api-before-2gb-$(date -u +%Y%m%dT%H%M%SZ)"
aws lightsail create-instance-snapshot --instance-name "$LEGACY_NAME" \
  --instance-snapshot-name "$SNAPSHOT_NAME" >/dev/null
for attempt in $(seq 1 120); do
  SNAPSHOT_STATE=$(aws lightsail get-instance-snapshot \
    --instance-snapshot-name "$SNAPSHOT_NAME" \
    --query 'instanceSnapshot.state' --output text)
  [ "$SNAPSHOT_STATE" = available ] && break
  [ "$SNAPSHOT_STATE" = error ] && { echo 'Snapshot failed'; exit 1; }
  [ "$attempt" -eq 120 ] && { echo 'Snapshot timed out'; exit 1; }
  sleep 15
done
```

Back on legacy:

```bash
sudo systemctl enable pm2-root
test "$(sudo systemctl is-enabled pm2-root)" = enabled
```

Use a first-boot script as a second worker guard:

```bash
cat >/tmp/dc-react-2gb-first-boot.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
systemctl disable --now pm2-root || true
pm2 kill || true
if test -f /etc/dc-react.env; then
  sed -Ei 's/^RUN_BACKGROUND_WORKERS=.*/RUN_BACKGROUND_WORKERS=no/' /etc/dc-react.env
fi
SCRIPT

aws lightsail create-instances-from-snapshot \
  --instance-snapshot-name "$SNAPSHOT_NAME" \
  --instance-names "$CANDIDATE_NAME" \
  --availability-zone ap-south-1a \
  --bundle-id "$API_2GB_BUNDLE_ID" \
  --ip-address-type dualstack \
  --user-data file:///tmp/dc-react-2gb-first-boot.sh \
  --tags key=Project,value=dc-react key=Environment,value=production key=Generation,value=2gb \
  >/dev/null
for attempt in $(seq 1 80); do
  CANDIDATE_STATE=$(aws lightsail get-instance --instance-name "$CANDIDATE_NAME" \
    --query 'instance.state.name' --output text 2>/dev/null || true)
  [ "$CANDIDATE_STATE" = running ] && break
  [ "$attempt" -eq 80 ] && { echo 'Candidate did not become running'; exit 1; }
  sleep 15
done
```

Snapshot-created instances do not copy custom firewall rules. Restrict SSH to
the administrator's current IPv4 before connecting; never open port 22 to all:

```bash
ADMIN_IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')
[[ "$ADMIN_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
PORT_INFOS=$(jq -nc --arg cidr "$ADMIN_IP/32" '[
  {fromPort:22,toPort:22,protocol:"tcp",cidrs:[$cidr]},
  {fromPort:80,toPort:80,protocol:"tcp",cidrs:["0.0.0.0/0"],ipv6Cidrs:["::/0"]},
  {fromPort:443,toPort:443,protocol:"tcp",cidrs:["0.0.0.0/0"],ipv6Cidrs:["::/0"]}
]')
aws lightsail put-instance-public-ports --instance-name "$CANDIDATE_NAME" \
  --port-infos "$PORT_INFOS" >/dev/null
```

On candidate, verify PM2 is not active; set 2 GB limits while keeping workers
off, then start only the API. Also verify the copied AWS credentials, database
settings, nginx/TLS, free disk, and checked-out Git SHA.

```bash
test "$(sudo systemctl is-active pm2-root || true)" != active
sudo pm2 kill || true
sudo sed -Ei \
  -e 's/^NODE_OPTIONS=.*/NODE_OPTIONS=--max-old-space-size=1280/' \
  -e 's/^RUN_BACKGROUND_WORKERS=.*/RUN_BACKGROUND_WORKERS=no/' \
  /etc/dc-react.env
sudo grep -Fx 'NODE_OPTIONS=--max-old-space-size=1280' /etc/dc-react.env
sudo grep -Fx 'RUN_BACKGROUND_WORKERS=no' /etc/dc-react.env
sudo bash -c '
  set -a; source /etc/dc-react.env; set +a
  cd /opt/dc-react/app/backend
  npm run prisma:generate
  npm run db:setup:runtime
  pm2 delete dc-react-api >/dev/null 2>&1 || true
  pm2 start src/server.mjs --name dc-react-api --max-memory-restart 1536M
  pm2 save
  systemctl enable pm2-root
'
curl -fsS http://127.0.0.1:8787/health \
  | jq -e '.ok == true and .database == "mysql" and .storage == "s3"' >/dev/null
```

Test from the administrator machine without moving DNS/static IP:

```bash
CANDIDATE_IP=$(aws lightsail get-instance --instance-name "$CANDIDATE_NAME" \
  --query 'instance.publicIpAddress' --output text)
curl --fail --silent --show-error \
  --resolve "aws-origin.dekhocampus.com:443:$CANDIDATE_IP" \
  https://aws-origin.dekhocampus.com/health \
  | jq -e '.ok == true and .database == "mysql" and .storage == "s3"' >/dev/null
```

Close SSH so candidate networking matches the template, then verify immutable
properties:

```bash
PORT_INFOS=$(jq -nc '[
  {fromPort:80,toPort:80,protocol:"tcp",cidrs:["0.0.0.0/0"],ipv6Cidrs:["::/0"]},
  {fromPort:443,toPort:443,protocol:"tcp",cidrs:["0.0.0.0/0"],ipv6Cidrs:["::/0"]}
]')
aws lightsail put-instance-public-ports --instance-name "$CANDIDATE_NAME" \
  --port-infos "$PORT_INFOS" >/dev/null
aws lightsail get-instance --instance-name "$CANDIDATE_NAME" --output json \
  | jq -e --arg name "$CANDIDATE_NAME" --arg bundle "$API_2GB_BUNDLE_ID" '
      .instance.name == $name and .instance.bundleId == $bundle
      and .instance.blueprintId == "ubuntu_24_04"
      and .instance.location.availabilityZone == "ap-south-1a"
      and .instance.hardware.ramSizeInGb == 2
      and .instance.hardware.cpuCount == 2
      and .instance.state.name == "running"' >/dev/null
```

## 3. Import while legacy remains active

Reuse current parameter values without copying them to the runbook. Only the
two migration parameters receive new values:

```bash
aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Parameters[].ParameterKey' --output json \
  | jq --arg bundle "$API_2GB_BUNDLE_ID" '
      [.[] | select(. != "ApiGenerationMode" and . != "Api2GbBundleId")
        | {ParameterKey: ., UsePreviousValue: true}]
      + [{ParameterKey:"ApiGenerationMode",ParameterValue:"dual-legacy"},
         {ParameterKey:"Api2GbBundleId",ParameterValue:$bundle}]' \
    >/tmp/dc-react-2gb-import-parameters.json

export IMPORT_CHANGE_SET="dc-react-import-api-2gb-$(date -u +%Y%m%dT%H%M%SZ)"
aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" --change-set-name "$IMPORT_CHANGE_SET" \
  --change-set-type IMPORT --template-body "file://$TEMPLATE" \
  --resources-to-import "file://$IMPORT_MAP" \
  --parameters file:///tmp/dc-react-2gb-import-parameters.json \
  --capabilities CAPABILITY_NAMED_IAM >/dev/null
aws cloudformation wait change-set-create-complete \
  --stack-name "$STACK_NAME" --change-set-name "$IMPORT_CHANGE_SET"
aws cloudformation describe-change-set --stack-name "$STACK_NAME" \
  --change-set-name "$IMPORT_CHANGE_SET" --output json \
  >/tmp/dc-react-2gb-import-change-set.json
jq -e '
  .Status == "CREATE_COMPLETE" and (.Changes | length) == 1
  and .Changes[0].ResourceChange.Action == "Import"
  and .Changes[0].ResourceChange.LogicalResourceId == "ApiInstance2Gb"
  and .Changes[0].ResourceChange.ResourceType == "AWS::Lightsail::Instance"
' /tmp/dc-react-2gb-import-change-set.json >/dev/null
```

Do not execute unless the assertion passes exactly. Import must not create,
delete, or modify an existing resource.

```bash
aws cloudformation execute-change-set --stack-name "$STACK_NAME" \
  --change-set-name "$IMPORT_CHANGE_SET"
aws cloudformation wait stack-import-complete --stack-name "$STACK_NAME"
test "$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Parameters[?ParameterKey=='ApiGenerationMode'].ParameterValue | [0]" \
  --output text)" = dual-legacy
test "$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiInstanceName'].OutputValue | [0]" \
  --output text)" = "$LEGACY_NAME"
test "$(aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" \
  --query 'staticIp.attachedTo' --output text)" = "$LEGACY_NAME"

aws cloudformation detect-stack-resource-drift --stack-name "$STACK_NAME" \
  --logical-resource-id ApiInstance2Gb --output json \
  >/tmp/dc-react-2gb-drift.json
jq -e '.StackResourceDrift.StackResourceDriftStatus == "IN_SYNC"' \
  /tmp/dc-react-2gb-drift.json >/dev/null
```

If drift appears, inspect `PropertyDifferences` and reconcile it before
cutover. Never alter `BundleId`, `BlueprintId`, `AvailabilityZone`, or
`InstanceName` just to hide an unexpected candidate.

## 4. Preview and execute cutover

```bash
aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Parameters[].ParameterKey' --output json \
  | jq '[.[] | select(. != "ApiGenerationMode")
      | {ParameterKey: ., UsePreviousValue: true}]
      + [{ParameterKey:"ApiGenerationMode",ParameterValue:"dual-2gb"}]' \
    >/tmp/dc-react-2gb-cutover-parameters.json
export CUTOVER_CHANGE_SET="dc-react-cutover-api-2gb-$(date -u +%Y%m%dT%H%M%SZ)"
aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" --change-set-name "$CUTOVER_CHANGE_SET" \
  --change-set-type UPDATE --template-body "file://$TEMPLATE" \
  --parameters file:///tmp/dc-react-2gb-cutover-parameters.json \
  --capabilities CAPABILITY_NAMED_IAM >/dev/null
aws cloudformation wait change-set-create-complete --stack-name "$STACK_NAME" \
  --change-set-name "$CUTOVER_CHANGE_SET"
aws cloudformation describe-change-set --stack-name "$STACK_NAME" \
  --change-set-name "$CUTOVER_CHANGE_SET" --output json \
  >/tmp/dc-react-2gb-cutover-change-set.json
jq -e '
  ([.Changes[].ResourceChange.LogicalResourceId] | sort)
    == ["ApiStaticIp", "CpuAlarm"]
  and all(.Changes[].ResourceChange; .Action == "Modify")
  and all(.Changes[].ResourceChange; .Replacement == "False")
' /tmp/dc-react-2gb-cutover-change-set.json >/dev/null
```

Do not execute unless it has exactly those two in-place modifications. On
legacy, set `RUN_BACKGROUND_WORKERS=no` and restart the API with `--update-env`;
verify it before proceeding. The candidate must still be `no`.

Execute the reviewed cutover, verify public traffic, then make candidate the
sole worker owner by setting `RUN_BACKGROUND_WORKERS=yes` and restarting it
with `--update-env`:

```bash
aws cloudformation execute-change-set --stack-name "$STACK_NAME" \
  --change-set-name "$CUTOVER_CHANGE_SET"
aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME"
test "$(aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" \
  --query 'staticIp.attachedTo' --output text)" = "$CANDIDATE_NAME"
test "$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiInstanceName'].OutputValue | [0]" \
  --output text)" = "$CANDIDATE_NAME"
test "$(aws cloudwatch describe-alarms --alarm-names dc-react-lightsail-high-cpu \
  --query 'MetricAlarms[0].Dimensions[?Name==`InstanceName`].Value | [0]' \
  --output text)" = "$CANDIDATE_NAME"
curl -fsS https://aws-origin.dekhocampus.com/health \
  | jq -e '.ok == true and .database == "mysql" and .storage == "s3"' >/dev/null
```

Run the normal production workflow with `update_infrastructure=false`. Its
active output now targets the 2 GB server; it deploys the immutable workflow
SHA, applies 2 GB memory limits, runs live regressions, and closes SSH.

If cutover/health fails, keep candidate workers `no`, restore legacy workers to
`yes`, and repeat the reviewed UPDATE procedure with
`ApiGenerationMode=dual-legacy`. Verify static IP, output, alarm, and public
health all point to legacy. Never roll back to `legacy` mode.

## 5. Soak and final cleanup

Keep legacy and the snapshot through the agreed rollback window. A stopped
Lightsail instance remains billable. Monitor health, errors, CPU,
memory/restarts, database connections, worker/outbox activity, and both
DekhoCampus and Sarkari public flows.

After soak, require mode `dual-2gb`, a green workflow, candidate ownership of
the IP/workers, and a current database backup. Create a final UPDATE change set
with `ApiGenerationMode=2gb` and all other parameters reused. It must contain
exactly one `Remove` for `ApiInstance`; static IP and alarm must be unchanged.
After execution verify:

```bash
test "$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Parameters[?ParameterKey=='ApiGenerationMode'].ParameterValue | [0]" \
  --output text)" = 2gb
if aws cloudformation describe-stack-resource --stack-name "$STACK_NAME" \
  --logical-resource-id ApiInstance >/dev/null 2>&1; then
  echo 'Legacy logical resource is still stack-managed.'; exit 1
fi
# DeletionPolicy: Retain means the physical rollback server still exists.
aws lightsail get-instance --instance-name "$LEGACY_NAME" >/dev/null
```

Only after separate explicit approval that rollback is no longer required:

```bash
aws lightsail delete-instance --instance-name "$LEGACY_NAME"
```

Retain/delete the manual snapshot under the backup policy. Run the normal
workflow once more and confirm mode stays `2gb`, static IP is unchanged, alarm
targets 2 GB, SSH is closed, and health/live regressions pass.
