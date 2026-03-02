#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[post-create] Enabling corepack"
corepack enable >/dev/null 2>&1 || true

echo "[post-create] Installing dependencies"
pnpm install

echo "[post-create] Validating Chromium/CHROME_PATH for Puppeteer"
if command -v chromium >/dev/null 2>&1; then
  chromium --version || true
else
  echo "[post-create] warning: chromium binary not found in PATH."
  echo "[post-create] hint: Rebuild devcontainer to apply browser install from .devcontainer/Dockerfile."
fi

if [ -n "${CHROME_PATH:-}" ]; then
  if [ -x "$CHROME_PATH" ]; then
    echo "[post-create] CHROME_PATH executable: $CHROME_PATH"
  else
    echo "[post-create] warning: CHROME_PATH is set but not executable: $CHROME_PATH"
    echo "[post-create] hint: In devcontainer, CHROME_PATH should be /usr/bin/chromium."
  fi
else
  echo "[post-create] warning: CHROME_PATH is not set."
  echo "[post-create] hint: Set CHROME_PATH=/usr/bin/chromium in .devcontainer/devcontainer.json."
fi

echo "[post-create] Syncing Ralph submodule"
git submodule sync --recursive
git submodule update --init --recursive tools/ralph-loop

echo "[post-create] Installing pre-push guard hook"
mkdir -p .git/hooks-guard
cp .devcontainer/pre-push-block.sh .git/hooks-guard/pre-push
chmod +x .git/hooks-guard/pre-push
git config core.hooksPath .git/hooks-guard

echo "[post-create] Configuring Git SSH signing"
bash .devcontainer/configure-git-ssh-signing.sh

echo "[post-create] Running Ralph doctor"
if ! bash scripts/ai/ralph-loop-doctor.sh; then
  echo "[post-create] warning: doctor found setup issues. See output above."
fi

if [ ! -d "/home/node/.codex" ]; then
  echo "[post-create] warning: /home/node/.codex is not mounted."
  echo "[post-create] run 'codex login --with-api-key' in container or configure host mount."
fi
