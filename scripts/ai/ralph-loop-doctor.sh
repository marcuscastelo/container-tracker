#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

status=0

check_ok() {
  printf '%s\n' "[ok] $*"
}

check_warn() {
  printf '%s\n' "[warn] $*" >&2
}

check_fail() {
  printf '%s\n' "[fail] $*" >&2
  status=1
}

if [ -d "$REPO_ROOT/.git" ]; then
  check_ok "Git repository detected at $REPO_ROOT"
else
  check_fail "No Git repository detected at $REPO_ROOT"
fi

if [ -f "$RALPH_LOOP_ROOT/ralph.sh" ] && [ -f "$RALPH_LOOP_ROOT/prompt.md" ]; then
  check_ok "Ralph submodule assets found at $RALPH_LOOP_ROOT"
else
  check_fail "Ralph submodule assets missing at $RALPH_LOOP_ROOT"
  check_warn "Run: git submodule update --init --recursive tools/ralph-loop"
fi

for command_name in jq git; do
  if command -v "$command_name" >/dev/null 2>&1; then
    check_ok "Command available: $command_name"
  else
    check_fail "Missing command: $command_name"
  fi
done

if ! ensure_agent_cli >/dev/null 2>&1; then
  check_fail "Agent CLI missing for RALPH_AGENT=$RALPH_AGENT"
else
  check_ok "Agent CLI available for RALPH_AGENT=$RALPH_AGENT"
fi

if [ "$RALPH_AGENT" = "codex" ] && command -v codex >/dev/null 2>&1; then
  codex_status_output=""
  if codex_status_output="$(codex login status 2>&1)"; then
    if printf '%s\n' "$codex_status_output" | grep -qi "logged in"; then
      check_ok "Codex authentication is active"
    else
      check_warn "Unable to confirm Codex login status from output"
      check_warn "codex login status output:"
      printf '%s\n' "$codex_status_output" >&2
    fi
  else
    check_warn "codex login status failed; authenticate with 'codex login --with-api-key'"
  fi
fi

if [ -d "$RALPH_LOOP_WORKDIR" ]; then
  check_ok "Ralph work directory exists at $RALPH_LOOP_WORKDIR"
else
  check_warn "Ralph work directory not created yet: $RALPH_LOOP_WORKDIR"
fi

exit "$status"
