#!/usr/bin/env bash
set -euo pipefail

if [ "${GIT_GUARD_BYPASS:-}" = "1" ]; then
  exit 0
fi

# Shared .git config means this hook also runs on host.
# Only block pushes when running inside a containerized dev environment.
if [ ! -f "/.dockerenv" ] && [ ! -f "/run/.containerenv" ] && [ "${DEVCONTAINER:-}" != "1" ]; then
  exit 0
fi

printf '%s\n' "pre-push hook: blocked in devcontainer policy." >&2
printf '%s\n' "Commit inside the container and run git push from the host machine." >&2
printf '%s\n' "Set GIT_GUARD_BYPASS=1 only for explicit one-off override." >&2
exit 1
