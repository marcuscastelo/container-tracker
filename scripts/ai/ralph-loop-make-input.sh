#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/ai/ralph-loop-make-input.sh <PLAN_FILE> <PROGRESS_FILE> [OUTPUT_INPUT_JSON]
EOF
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  usage
  exit 1
fi

require_command jq

plan_file="$(abs_path "$1")"
progress_file="$(abs_path "$2")"
output_file="${3:-$RALPH_LOOP_WORKDIR/input.json}"
output_file="$(abs_path "$output_file")"

if [ ! -f "$plan_file" ]; then
  rl_error "Plan file not found: $plan_file"
  exit 1
fi

mkdir -p "$RALPH_LOOP_WORKDIR"
mkdir -p "$(dirname "$progress_file")"
mkdir -p "$(dirname "$output_file")"

if [ ! -f "$progress_file" ]; then
  {
    printf '%s\n' "# Ralph Progress Log"
    printf '%s\n' "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '%s\n' "---"
  } > "$progress_file"
fi

dangerous_exec=false
if [ "$RALPH_ALLOW_DANGEROUS_EXEC" = "1" ]; then
  dangerous_exec=true
fi

generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

jq -n \
  --arg version "1" \
  --arg agent "$RALPH_AGENT" \
  --arg repoRoot "$REPO_ROOT" \
  --arg loopRoot "$RALPH_LOOP_ROOT" \
  --arg workDir "$RALPH_LOOP_WORKDIR" \
  --arg planFile "$plan_file" \
  --arg progressFile "$progress_file" \
  --arg generatedAt "$generated_at" \
  --argjson maxIterations "$RALPH_MAX_ITERATIONS" \
  --argjson allowDangerousExec "$dangerous_exec" \
  '{
    version: $version,
    agent: $agent,
    repoRoot: $repoRoot,
    loopRoot: $loopRoot,
    workDir: $workDir,
    planFile: $planFile,
    progressFile: $progressFile,
    maxIterations: $maxIterations,
    allowDangerousExec: $allowDangerousExec,
    generatedAt: $generatedAt
  }' > "$output_file"

rl_info "Ralph input generated: $output_file"
