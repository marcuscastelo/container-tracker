#!/usr/bin/env bash
# Run the packaged server binary (if present) and the AppImage UI.
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SRV_BIN="$ROOT_DIR/dist/servers/server-linux"
APPIMAGE="$ROOT_DIR/dist/Container Tracker-0.0.0.AppImage"

if [ ! -x "$SRV_BIN" ]; then
  echo "Server binary not found or not executable: $SRV_BIN"
  echo "Build servers with: pnpm run build:servers:linux"
  exit 1
fi

echo "Starting server: $SRV_BIN"
"$SRV_BIN" > /tmp/container-tracker-server.log 2>&1 &
SERVER_PID=$!

trap 'echo "Shutting down..."; kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; exit' INT TERM EXIT

sleep 1

if [ ! -x "$APPIMAGE" ]; then
  echo "AppImage not found: $APPIMAGE"
  echo "Build desktop with: pnpm run electron:build"
  exit 1
fi

echo "Launching UI AppImage: $APPIMAGE"
"$APPIMAGE" --no-sandbox &
UI_PID=$!

# Wait for UI to exit
wait "$UI_PID"

# Cleanup server
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

trap - INT TERM EXIT
