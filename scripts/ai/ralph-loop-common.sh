#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export RALPH_AGENT="${RALPH_AGENT:-claude}"
export RALPH_LOOP_ROOT="${RALPH_LOOP_ROOT:-$REPO_ROOT/tools/ralph-loop}"
export RALPH_LOOP_WORKDIR="${RALPH_LOOP_WORKDIR:-$REPO_ROOT/.ralph-loop}"
export RALPH_MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-10}"
export RALPH_ALLOW_DANGEROUS_EXEC="${RALPH_ALLOW_DANGEROUS_EXEC:-1}"
export RALPH_AGENT_TIMEOUT_SECONDS="${RALPH_AGENT_TIMEOUT_SECONDS:-0}"
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

run_with_optional_timeout() {
  local timeout_seconds="$1"
  shift

  if ! [[ "$timeout_seconds" =~ ^[0-9]+$ ]]; then
    rl_error "Invalid RALPH_AGENT_TIMEOUT_SECONDS='$timeout_seconds'. Expected non-negative integer."
    return 1
  fi

  if [ "$timeout_seconds" -le 0 ]; then
    "$@"
    return $?
  fi

  if command -v timeout >/dev/null 2>&1; then
    timeout --foreground "$timeout_seconds" "$@"
    return $?
  fi

  rl_info "[ralph] timeout command not found; running without timeout."
  "$@"
}

run_agent_prompt() {
  local prompt_file="$1"
  local output_file="$2"
  local phase_label="${3:-agent prompt}"
  local start_epoch
  local elapsed_seconds
  local timeout_note
  local heartbeat_pid=""
  local status

  if ! [[ "$RALPH_AGENT_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]]; then
    rl_error "Invalid RALPH_AGENT_TIMEOUT_SECONDS='$RALPH_AGENT_TIMEOUT_SECONDS'. Expected non-negative integer."
    return 1
  fi

  if [ "$RALPH_AGENT_TIMEOUT_SECONDS" -gt 0 ]; then
    timeout_note="${RALPH_AGENT_TIMEOUT_SECONDS}s"
  else
    timeout_note="disabled"
  fi

  start_epoch="$(date +%s)"
  rl_info "[ralph][$RALPH_AGENT] $phase_label started (timeout: $timeout_note)"

  (
    while :; do
      sleep 20
      elapsed_seconds="$(( $(date +%s) - start_epoch ))"
      rl_info "[ralph][$RALPH_AGENT] $phase_label still running (${elapsed_seconds}s)..."
    done
  ) &
  heartbeat_pid="$!"

  set +e

  case "$RALPH_AGENT" in
    codex)
      local mode_flag
      mode_flag="$(codex_exec_mode_flag)"
      run_with_optional_timeout "$RALPH_AGENT_TIMEOUT_SECONDS" \
        codex exec --cd "$REPO_ROOT" --skip-git-repo-check "$mode_flag" -o "$output_file" - < "$prompt_file"
      ;;
    claude)
      run_with_optional_timeout "$RALPH_AGENT_TIMEOUT_SECONDS" \
        env \
          ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-$RALPH_CLAUDE_BASE_URL}" \
          ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$RALPH_CLAUDE_AUTH_TOKEN}" \
        claude \
          --model "$RALPH_CLAUDE_MODEL" \
          --dangerously-skip-permissions \
          --print < "$prompt_file" > "$output_file"
      ;;
    amp)
      run_with_optional_timeout "$RALPH_AGENT_TIMEOUT_SECONDS" \
        amp --dangerously-allow-all < "$prompt_file" > "$output_file"
      ;;
  esac

  status="$?"
  set -e

  if [ -n "$heartbeat_pid" ]; then
    kill "$heartbeat_pid" >/dev/null 2>&1 || true
    wait "$heartbeat_pid" 2>/dev/null || true
  fi

  elapsed_seconds="$(( $(date +%s) - start_epoch ))"

  if [ "$status" -ne 0 ]; then
    if [ "$status" -eq 124 ] && [ "$RALPH_AGENT_TIMEOUT_SECONDS" -gt 0 ]; then
      rl_error "[ralph][$RALPH_AGENT] $phase_label timed out after ${RALPH_AGENT_TIMEOUT_SECONDS}s"
    else
      rl_error "[ralph][$RALPH_AGENT] $phase_label failed with exit code $status"
    fi
    return "$status"
  fi

  rl_info "[ralph][$RALPH_AGENT] $phase_label completed in ${elapsed_seconds}s"
}
