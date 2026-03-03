#!/usr/bin/env bash
set -euo pipefail

if [ "${GIT_GUARD_BYPASS:-}" = "1" ]; then
  exit 0
fi

# Shared .git config means this hook also runs on host.
# Only enforce push guard rules when running inside a containerized dev environment.
if [ ! -f "/.dockerenv" ] && [ ! -f "/run/.containerenv" ] && [ "${DEVCONTAINER:-}" != "1" ]; then
  exit 0
fi

ZERO_SHA="0000000000000000000000000000000000000000"
blocked=0

is_protected_ref() {
  case "$1" in
    refs/heads/main | refs/heads/master)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

while read -r local_ref local_sha remote_ref remote_sha; do
  [ -n "${remote_ref:-}" ] || continue

  if [ "${local_ref:-}" = "(delete)" ] || [ "${local_sha:-}" = "$ZERO_SHA" ]; then
    printf '%s\n' "pre-push hook: blocked deletion of remote ref '$remote_ref' in devcontainer." >&2
    blocked=1
    continue
  fi

  if is_protected_ref "$remote_ref"; then
    printf '%s\n' "pre-push hook: blocked push to protected branch '$remote_ref' in devcontainer." >&2
    blocked=1
  fi
done

if [ "$blocked" -eq 1 ]; then
  printf '%s\n' "pre-push hook: regular branch push to non-protected refs is allowed." >&2
  printf '%s\n' "Set GIT_GUARD_BYPASS=1 only for explicit one-off override." >&2
  exit 1
fi

exit 0
