#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[post-start] Refreshing pre-push guard hook"
mkdir -p .git/hooks-guard
cp .devcontainer/pre-push-block.sh .git/hooks-guard/pre-push
chmod +x .git/hooks-guard/pre-push
git config core.hooksPath .git/hooks-guard

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

echo "[post-start] Refreshing Git SSH signing setup"
bash .devcontainer/configure-git-ssh-signing.sh

if [ ! -f "tools/ralph-loop/ralph.sh" ]; then
  echo "[post-start] warning: tools/ralph-loop not initialized."
  echo "[post-start] run: git submodule update --init --recursive tools/ralph-loop"
fi
