#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/ai/ralph-loop-plan.sh <PROMPT_OR_FILE> [OUTPUT_PRD_JSON]
EOF
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage
  exit 1
fi

require_command jq
ensure_loop_assets
ensure_agent_cli

mkdir -p "$RALPH_LOOP_WORKDIR"

input_arg="$1"
output_file="${2:-$RALPH_LOOP_WORKDIR/prd.json}"
output_file="$(abs_path "$output_file")"
raw_output_file="$RALPH_LOOP_WORKDIR/last-plan-output.txt"

user_prompt="$(resolve_input_text "$input_arg")"

tmp_prompt_file="$(mktemp)"
tmp_clean_file="$(mktemp)"
tmp_fenced_file="$(mktemp)"
trap 'rm -f "$tmp_prompt_file" "$tmp_clean_file" "$tmp_fenced_file"' EXIT

cat > "$tmp_prompt_file" <<EOF
You are generating a PRD JSON for Ralph autonomous execution.

Return only valid JSON. Do not include markdown fences and do not include extra text.
Use this structure and field names:

$(cat "$RALPH_LOOP_ROOT/prd.json.example")

Requirements:
- Keep all user stories small enough to complete in one loop iteration.
- Keep priorities unique and ascending.
- Set "passes": false for every user story.
- Set "notes": "" for every user story.
- Keep acceptance criteria specific and verifiable.

User request:
$user_prompt
EOF

run_agent_prompt "$tmp_prompt_file" "$raw_output_file" "PRD planning"
tr -d '\r' < "$raw_output_file" | sed '/^[[:space:]]*```/d' > "$tmp_clean_file"

valid_json_file=""
if jq empty "$tmp_clean_file" >/dev/null 2>&1; then
  valid_json_file="$tmp_clean_file"
else
  # Some agents return explanatory text + fenced JSON. Keep only the first fenced block.
  awk '
    BEGIN { in_fence=0 }
    /^[[:space:]]*```/ {
      if (in_fence == 0) { in_fence=1; next }
      exit
    }
    in_fence == 1 { print }
  ' "$raw_output_file" > "$tmp_fenced_file"

  if [ -s "$tmp_fenced_file" ] && jq empty "$tmp_fenced_file" >/dev/null 2>&1; then
    valid_json_file="$tmp_fenced_file"
  fi
fi

if [ -z "$valid_json_file" ]; then
  raw_summary="$(tr -d '\r' < "$raw_output_file" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [ "$raw_summary" = "Execution error" ]; then
    rl_error "Agent returned 'Execution error' instead of PRD JSON."
    if [ "$RALPH_AGENT" = "claude" ]; then
      rl_error "Claude endpoint: ${ANTHROPIC_BASE_URL:-$RALPH_CLAUDE_BASE_URL}"
      rl_error "Claude model: $RALPH_CLAUDE_MODEL"
      rl_error "Tip: retry with --agent codex or verify the Claude endpoint/model."
    fi
  fi
  rl_error "Generated output is not valid JSON."
  rl_error "Inspect raw output at: $raw_output_file"
  exit 1
fi

mkdir -p "$(dirname "$output_file")"
cp "$valid_json_file" "$output_file"

rl_info "Ralph PRD generated: $output_file"
