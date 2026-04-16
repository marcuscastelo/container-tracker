#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export RALPH_AGENT="${RALPH_AGENT:-codex}"
export RALPH_LOOP_ROOT="${RALPH_LOOP_ROOT:-$REPO_ROOT/tools/ralph-loop}"
export RALPH_LOOP_WORKDIR="${RALPH_LOOP_WORKDIR:-$REPO_ROOT/.ralph-loop}"
export RALPH_MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-10}"
export RALPH_ALLOW_DANGEROUS_EXEC="${RALPH_ALLOW_DANGEROUS_EXEC:-1}"
export RALPH_CLAUDE_MODEL="${RALPH_CLAUDE_MODEL:-google/gemma-4-e4b}"
export RALPH_CLAUDE_BASE_URL="${RALPH_CLAUDE_BASE_URL:-http://localhost:1234}"
export RALPH_CLAUDE_AUTH_TOKEN="${RALPH_CLAUDE_AUTH_TOKEN:-lmstudio}"

rl_info() {
  printf '%s\n' "$*"
}

rl_error() {
  printf '%s\n' "$*" >&2
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    rl_error "Missing required command: $1"
    return 1
  fi
}

ensure_loop_assets() {
  if [ ! -f "$RALPH_LOOP_ROOT/prompt.md" ] || [ ! -f "$RALPH_LOOP_ROOT/prd.json.example" ]; then
    rl_error "Ralph assets not found at: $RALPH_LOOP_ROOT"
    rl_error "Run: git submodule update --init --recursive tools/ralph-loop"
    return 1
  fi
}

ensure_agent_cli() {
  case "$RALPH_AGENT" in
    codex)
      require_command codex
      ;;
    claude)
      require_command claude
      ;;
    amp)
      require_command amp
      ;;
    *)
      rl_error "Unsupported RALPH_AGENT='$RALPH_AGENT'. Use codex, claude, or amp."
      return 1
      ;;
  esac
}

resolve_input_text() {
  local input="$1"
  if [ -f "$input" ]; then
    cat "$input"
    return 0
  fi

  printf '%s\n' "$input"
}

abs_path() {
  local raw_path="$1"
  if [[ "$raw_path" = /* ]]; then
    printf '%s\n' "$raw_path"
    return 0
  fi

  printf '%s/%s\n' "$PWD" "$raw_path"
}

codex_exec_mode_flag() {
  if [ "$RALPH_ALLOW_DANGEROUS_EXEC" = "1" ]; then
    printf '%s\n' "--dangerously-bypass-approvals-and-sandbox"
    return 0
  fi

  printf '%s\n' "--full-auto"
}

run_agent_prompt() {
  local prompt_file="$1"
  local output_file="$2"

  case "$RALPH_AGENT" in
    codex)
      local mode_flag
      mode_flag="$(codex_exec_mode_flag)"
      codex exec --cd "$REPO_ROOT" --skip-git-repo-check "$mode_flag" -o "$output_file" - < "$prompt_file"
      ;;
    claude)
      ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-$RALPH_CLAUDE_BASE_URL}" \
      ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$RALPH_CLAUDE_AUTH_TOKEN}" \
        claude \
          --model "$RALPH_CLAUDE_MODEL" \
          --dangerously-skip-permissions \
          --print < "$prompt_file" > "$output_file"
      ;;
    amp)
      amp --dangerously-allow-all < "$prompt_file" > "$output_file"
      ;;
  esac
}
