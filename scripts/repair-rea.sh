#!/usr/bin/env bash
set -euo pipefail

# Run from ordinary macOS Terminal, not a restricted agent executor.
# Scope: Codex REA registration + bundled workflow. No native applications.
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

plan_only=false
if [ "${1:-}" = "--plan-only" ] && [ "$#" -eq 1 ]; then
  plan_only=true
elif [ "$#" -ne 0 ]; then
  echo 'Usage: bash scripts/repair-rea.sh [--plan-only]' >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is required. The tested runtime is Node 24.22.0.' >&2
  exit 1
fi

rea_command() {
  if [ -f "$project_root/.local/rea-runtime/scripts/rea.mjs" ]; then
    node "$project_root/.local/rea-runtime/scripts/rea.mjs" "$@"
  else
    npx -y rea-agents@6.7.0 "$@"
  fi
}

if [ "$plan_only" = true ]; then
  rea_command setup --client codex --dry-run --json
  exit 0
fi

mkdir -p .local
report_directory="$(mktemp -d "$project_root/.local/rea-recovery.XXXXXX")"
echo "Local diagnostic reports: $report_directory"
rea_version="$(rea_command --version)"
if [ "$rea_version" != '6.7.0' ]; then
  echo "Expected REA 6.7.0; found $rea_version. No configuration changed." >&2
  exit 1
fi

if ! rea_command setup --client codex --dry-run --json > "$report_directory/plan.json"; then
  cat "$report_directory/plan.json"
  echo 'Setup planning failed. No apply was attempted.' >&2
  exit 1
fi
cat "$report_directory/plan.json"

# The user authorised repair of this explicit client scope.
if ! rea_command setup --client codex --yes --json > "$report_directory/setup.json"; then
  cat "$report_directory/setup.json"
  echo 'REA setup failed. Run this script in ordinary Terminal with access to your own Codex configuration; do not use sudo.' >&2
  exit 1
fi

if ! rea_command doctor --client codex --skill --json > "$report_directory/doctor.json"; then
  cat "$report_directory/doctor.json"
  echo 'Codex-scoped REA health check failed. Do not mark Phase 0 complete.' >&2
  exit 1
fi

node --test fixtures/rea-smoke/app.test.mjs
if ! rea_command analyze-javascript-application "$project_root/fixtures/rea-smoke" --json > "$report_directory/analysis.json"; then
  echo 'Owned-fixture analysis failed. Review the report, including cleanup diagnostics; do not mark REA verified.' >&2
  echo "$report_directory/analysis.json" >&2
  exit 1
fi

echo 'Setup, Codex health check, fixture behavior tests and CLI analysis returned success.'
echo "Reports: $report_directory"
echo 'Live Codex MCP verification is still required. Exit the old Codex session and run:'
printf '  cd %q\n  codex\n' "$project_root"
echo 'In that fresh session: use /mcp, verify REA identity and analyse fixtures/rea-smoke through the live REA tool.'
echo 'Resume Fire Take Off from AGENTS.md and docs/CURRENT_STATE.md; do not claim full parity from this tooling check.'
