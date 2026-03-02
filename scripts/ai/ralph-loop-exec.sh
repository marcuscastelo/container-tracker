#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/ai/ralph-loop-exec.sh <INPUT_JSON>
EOF
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ $# -ne 1 ]; then
  usage
  exit 1
fi

require_command jq
ensure_loop_assets

input_file="$(abs_path "$1")"
if [ ! -f "$input_file" ]; then
  rl_error "Input JSON not found: $input_file"
  exit 1
fi

if ! jq empty "$input_file" >/dev/null 2>&1; then
  rl_error "Invalid input JSON: $input_file"
  exit 1
fi

input_agent="$(jq -r '.agent // empty' "$input_file")"
if [ -n "$input_agent" ]; then
  export RALPH_AGENT="$input_agent"
fi

input_max_iterations="$(jq -r '.maxIterations // empty' "$input_file")"
if [ -n "$input_max_iterations" ]; then
  export RALPH_MAX_ITERATIONS="$input_max_iterations"
fi

input_dangerous="$(jq -r '.allowDangerousExec // empty' "$input_file")"
if [ "$input_dangerous" = "true" ]; then
  export RALPH_ALLOW_DANGEROUS_EXEC="1"
elif [ "$input_dangerous" = "false" ]; then
  export RALPH_ALLOW_DANGEROUS_EXEC="0"
fi

ensure_agent_cli

plan_file="$(jq -r '.planFile // empty' "$input_file")"
progress_file="$(jq -r '.progressFile // empty' "$input_file")"
if [ -z "$plan_file" ] || [ -z "$progress_file" ]; then
  rl_error "Input JSON must include planFile and progressFile."
  exit 1
fi

plan_file="$(abs_path "$plan_file")"
progress_file="$(abs_path "$progress_file")"

if [ ! -f "$plan_file" ]; then
  rl_error "Plan file not found: $plan_file"
  exit 1
fi

mkdir -p "$RALPH_LOOP_WORKDIR"
mkdir -p "$(dirname "$progress_file")"

runtime_dir="$RALPH_LOOP_WORKDIR/runtime"
mkdir -p "$runtime_dir"

cp "$plan_file" "$runtime_dir/prd.json"
cp "$RALPH_LOOP_ROOT/prompt.md" "$runtime_dir/prompt.md"

if [ -f "$progress_file" ]; then
  cp "$progress_file" "$runtime_dir/progress.txt"
else
  {
    printf '%s\n' "# Ralph Progress Log"
    printf '%s\n' "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '%s\n' "---"
  } > "$runtime_dir/progress.txt"
fi

last_output_file="$RALPH_LOOP_WORKDIR/last-exec-output.txt"

for iteration in $(seq 1 "$RALPH_MAX_ITERATIONS"); do
  rl_info "Ralph iteration $iteration/$RALPH_MAX_ITERATIONS using agent '$RALPH_AGENT'"

  iteration_prompt_file="$(mktemp)"
  cat > "$iteration_prompt_file" <<EOF
You are executing one Ralph loop iteration in this repository.

Repository root: $REPO_ROOT
Ralph runtime directory: $runtime_dir

Instructions:
$(cat "$runtime_dir/prompt.md")

Path mapping rules:
- In the instructions, references to files "in the same directory as this file" mean:
  - $runtime_dir/prd.json
  - $runtime_dir/progress.txt
- Work on exactly one story per iteration.
- If all stories are complete, print <promise>COMPLETE</promise>.
EOF

  run_agent_prompt "$iteration_prompt_file" "$last_output_file" || true
  rm -f "$iteration_prompt_file"

  if [ -f "$runtime_dir/prd.json" ]; then
    cp "$runtime_dir/prd.json" "$plan_file"
  fi

  if [ -f "$runtime_dir/progress.txt" ]; then
    cp "$runtime_dir/progress.txt" "$progress_file"
  fi

  if grep -q "<promise>COMPLETE</promise>" "$last_output_file"; then
    rl_info "Ralph loop completed all stories."
    exit 0
  fi

  sleep 2
done

rl_error "Ralph loop reached max iterations without completion."
rl_error "Check progress file: $progress_file"
exit 1
