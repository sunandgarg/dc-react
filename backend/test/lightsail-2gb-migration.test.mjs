import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [template, workflow, runbook, importMap] = await Promise.all([
  readFile(new URL("../../infra/aws/lightsail-production.yaml", import.meta.url), "utf8"),
  readFile(new URL("../../.github/workflows/deploy-aws-lightsail.yml", import.meta.url), "utf8"),
  readFile(new URL("../../infra/aws/LIGHTSAIL-2GB-MIGRATION.md", import.meta.url), "utf8"),
  readFile(new URL("../../infra/aws/lightsail-2gb-import-resources.json", import.meta.url), "utf8"),
]);

test("the 2 GB API is imported as a retained second generation", () => {
  assert.match(template, /ApiGenerationMode:[\s\S]*AllowedValues: \[legacy, dual-legacy, dual-2gb, 2gb\]/);
  assert.match(template, /ApiInstance2Gb:[\s\S]*Condition: ManageApi2Gb[\s\S]*DeletionPolicy: Retain[\s\S]*UpdateReplacePolicy: Retain/);
  assert.match(template, /InstanceName: !Sub '\$\{ProjectName\}-api-lightsail-2gb'/);
  assert.match(template, /AttachedTo: !If \[UseApi2Gb, !Ref ApiInstance2Gb, !Ref ApiInstance\]/);
  assert.deepEqual(JSON.parse(importMap), [{
    ResourceType: "AWS::Lightsail::Instance",
    LogicalResourceId: "ApiInstance2Gb",
    ResourceIdentifier: { InstanceName: "dc-react-api-lightsail-2gb" },
  }]);
});

test("routine deploys cannot select a migration generation or resize in place", () => {
  assert.doesNotMatch(workflow.slice(0, workflow.indexOf("permissions:")), /api_generation|2gb/i);
  assert.match(workflow, /TARGET_INSTANCE_BUNDLE_ID=micro_3_1/);
  assert.match(workflow, /Preserving API generation mode/);
  assert.match(workflow, /hardware\.ramSizeInGb == 2/);
  assert.match(workflow, /ApiLegacyInstanceName[\s\S]*Api2GbInstanceName/);
});

test("the runbook fails closed at import and cutover boundaries", () => {
  assert.match(runbook, /\.Changes \| length\) == 1/);
  assert.match(runbook, /ResourceChange\.Action == "Import"/);
  assert.match(runbook, /LogicalResourceId == "ApiInstance2Gb"/);
  assert.match(runbook, /== \["ApiStaticIp", "CpuAlarm"\]/);
  assert.match(runbook, /RUN_BACKGROUND_WORKERS=no/);
  assert.match(runbook, /Never roll back to `legacy` mode/);
});
