#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[post-start] Checking Codex CLI"
if command -v codex >/dev/null 2>&1; then
  codex --version || true
else
  echo "[post-start] error: codex command not found."
fi

echo "[post-start] Checking Codex authentication"
if command -v codex >/dev/null 2>&1; then
  if ! codex login status; then
    echo "[post-start] warning: Codex is not authenticated."
  fi
fi

echo "[post-start] Checking SSH agent forwarding"
if [ -S "${SSH_AUTH_SOCK:-}" ]; then
  if ssh-add -l >/dev/null 2>&1; then
    echo "[post-start] SSH identities available via agent."
  else
    echo "[post-start] warning: SSH agent is mounted, but no identities are loaded."
    echo "[post-start] on host, run: ssh-add <your-key> and reopen/restart the devcontainer."
  fi
else
  echo "[post-start] warning: SSH agent socket not available in container."
  echo "[post-start] rebuild/reopen devcontainer after ensuring SSH_AUTH_SOCK is set on host."
fi

if [ ! -f "tools/ralph-loop/ralph.sh" ]; then
  echo "[post-start] warning: tools/ralph-loop not initialized."
  echo "[post-start] run: git submodule update --init --recursive tools/ralph-loop"
fi
