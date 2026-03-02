#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${1:-$HOME/.codex/skills}"
TARGET_DIR="${2:-$REPO_ROOT/tools/codex-skills-global}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source skills directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude '__pycache__/' --exclude '*.pyc' "$SOURCE_DIR/" "$TARGET_DIR/"
else
  rm -rf "$TARGET_DIR"
  mkdir -p "$TARGET_DIR"
  cp -a "$SOURCE_DIR/." "$TARGET_DIR/"
fi

echo "Synced global skills:"
echo "  source: $SOURCE_DIR"
echo "  target: $TARGET_DIR"
