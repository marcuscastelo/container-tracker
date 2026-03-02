#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[post-create] Enabling corepack"
corepack enable >/dev/null 2>&1 || true

echo "[post-create] Installing dependencies"
pnpm install

echo "[post-create] Syncing Ralph submodule"
git submodule sync --recursive
git submodule update --init --recursive tools/ralph-loop

echo "[post-create] Installing pre-push guard hook"
mkdir -p .git/hooks-guard
cp .devcontainer/pre-push-block.sh .git/hooks-guard/pre-push
chmod +x .git/hooks-guard/pre-push
git config core.hooksPath .git/hooks-guard

echo "[post-create] Running Ralph doctor"
if ! bash scripts/ai/ralph-loop-doctor.sh; then
  echo "[post-create] warning: doctor found setup issues. See output above."
fi

if [ ! -d "/home/node/.codex" ]; then
  echo "[post-create] warning: /home/node/.codex is not mounted."
  echo "[post-create] run 'codex login --with-api-key' in container or configure host mount."
fi
