#!/usr/bin/env bash
set -euo pipefail

pnpm run dev:server -- "$@" &
server_pid=$!

pnpm run agent:run &
agent_pid=$!

cleanup() {
  kill "$server_pid" "$agent_pid" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait "$server_pid" "$agent_pid"