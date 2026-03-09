#!/usr/bin/env bash
set -euo pipefail

pnpm run dev:server -- "$@" &
server_pid=$!

pnpm run agent:run &
agent_pid=$!

# status_file may be set later; ensure cleanup removes it too
status_file=""
cleanup() {
  kill "$server_pid" "$agent_pid" 2>/dev/null || true
  [ -n "${status_file:-}" ] && rm -f "$status_file"
}

trap cleanup EXIT INT TERM

# Prefer wait -n when available (bash >= 4.3). Otherwise emulate.
use_wait_n=false
if [ -n "${BASH_VERSINFO:-}" ]; then
  major=${BASH_VERSINFO[0]:-0}
  minor=${BASH_VERSINFO[1]:-0}
  if [ "$major" -gt 4 ] || { [ "$major" -eq 4 ] && [ "$minor" -ge 3 ]; }; then
    use_wait_n=true
  fi
fi

if [ "$use_wait_n" = true ]; then
  # wait for the first child to exit
  wait -n
  rc=$?

  # determine which child is still alive and kill it
  if kill -0 "$server_pid" 2>/dev/null; then
    # server is alive -> agent exited first
    kill "$server_pid" 2>/dev/null || true
  else
    # agent is alive -> server exited first
    kill "$agent_pid" 2>/dev/null || true
  fi

  # propagate the exit code of the process that exited first
  exit "$rc"
else
  # portable fallback: spawn waiters that write pid:status to a temp file
  status_file=$(mktemp -t dev-wait.XXXXXX)

  ( wait "$server_pid"; echo "$server_pid:$?" >> "$status_file" ) &
  ( wait "$agent_pid"; echo "$agent_pid:$?" >> "$status_file" ) &

  # block until first line is written
  while [ ! -s "$status_file" ]; do
    sleep 0.05
  done

  read -r line < "$status_file"
  exited_pid=${line%%:*}
  rc=${line##*:}

  # kill the other process
  if [ "$exited_pid" = "$server_pid" ]; then
    other_pid=$agent_pid
  else
    other_pid=$server_pid
  fi
  kill "$other_pid" 2>/dev/null || true

  # exit with the status of the process that exited first
  exit "$rc"
fi