#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/ai/ralph-loop-update.sh [--remote]

Options:
  --remote   Update submodule to latest remote commit on tracked branch.
EOF
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ $# -gt 1 ]; then
  usage
  exit 1
fi

update_mode="${1:-}"
if [ -n "$update_mode" ] && [ "$update_mode" != "--remote" ]; then
  usage
  exit 1
fi

cd "$REPO_ROOT"

echo "[update] Syncing Ralph submodule URL"
git submodule sync --recursive tools/ralph-loop

if [ "$update_mode" = "--remote" ]; then
  echo "[update] Updating Ralph submodule from remote"
  git submodule update --init --remote --recursive tools/ralph-loop
else
  echo "[update] Initializing Ralph submodule to pinned commit"
  git submodule update --init --recursive tools/ralph-loop
fi

submodule_sha="$(git -C tools/ralph-loop rev-parse --short HEAD)"
echo "[update] Ralph submodule now at commit: $submodule_sha"
