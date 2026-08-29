#!/usr/bin/env bash
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-main}"
BUDGET_EMAIL="${AWS_BUDGET_EMAIL:-${1:-}}"
AWS_WORKFLOW="deploy-aws-lightsail.yml"
CLOUDFLARE_WORKFLOW="deploy-cloudflare-pages.yml"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

for command in git gh curl jq; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing required command: $command"; exit 1; }
done

CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "You are on '$CURRENT_BRANCH'. Switch to '$BRANCH' before deploying."
  exit 1
fi

if [ -z "$BUDGET_EMAIL" ]; then
  echo "Usage: npm run deploy:prod -- alerts@example.com"
  echo "Or set AWS_BUDGET_EMAIL before running the command."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked changes are not committed. Commit the intended release before deploying."
  exit 1
fi

git fetch origin "$BRANCH"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
  echo "Local $BRANCH and origin/$BRANCH differ. Push or pull before deploying."
  exit 1
fi

SHA="$(git rev-parse HEAD)"

latest_run_for_sha() {
  local workflow="$1"
  gh run list --workflow "$workflow" --branch "$BRANCH" --event workflow_dispatch \
    --limit 20 --json databaseId,headSha \
    --jq ".[] | select(.headSha == \"$SHA\") | .databaseId" | head -1
}

wait_for_run() {
  local workflow="$1"
  local previous_run_id="${2:-}"
  local run_id=""
  for _ in $(seq 1 30); do
    run_id="$(latest_run_for_sha "$workflow")"
    [ -n "$run_id" ] && [ "$run_id" != "$previous_run_id" ] && break
    sleep 2
  done
  [ -n "$run_id" ] || { echo "Could not find the dispatched $workflow run."; exit 1; }
  echo "Watching $workflow run $run_id..."
  gh run watch "$run_id" --exit-status
}

echo "Deploying $SHA to AWS..."
PREVIOUS_AWS_RUN_ID="$(latest_run_for_sha "$AWS_WORKFLOW")"
gh workflow run "$AWS_WORKFLOW" --ref "$BRANCH" \
  -f budget_email="$BUDGET_EMAIL" \
  -f run_ai_smoke=false \
  -f repair_listed_article_covers=false
wait_for_run "$AWS_WORKFLOW" "$PREVIOUS_AWS_RUN_ID"

echo "Deploying $SHA to Cloudflare Pages..."
PREVIOUS_CLOUDFLARE_RUN_ID="$(latest_run_for_sha "$CLOUDFLARE_WORKFLOW")"
gh workflow run "$CLOUDFLARE_WORKFLOW" --ref "$BRANCH"
wait_for_run "$CLOUDFLARE_WORKFLOW" "$PREVIOUS_CLOUDFLARE_RUN_ID"

echo "Verifying production..."
curl --fail --silent --show-error --max-time 20 \
  https://aws-origin.dekhocampus.com/health \
  | jq -e '.ok == true and .database == "mysql" and .storage == "s3"' >/dev/null
curl --fail --silent --show-error --max-time 20 \
  https://dekhocampus.com/version.json \
  | jq -e --arg sha "$SHA" '.buildId == $sha' >/dev/null

echo "Production deployment complete: $SHA"
