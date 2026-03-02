#!/usr/bin/env bash
set -euo pipefail

REAL_GIT="/usr/bin/git"

deny() {
  printf '%s\n' "git-guard: blocked '$*'." >&2
  printf '%s\n' "git-guard: commits are allowed in container, but remote writes and destructive local commands are blocked." >&2
  printf '%s\n' "git-guard: push from host. Use GIT_GUARD_BYPASS=1 only for explicit one-off override." >&2
  exit 1
}

if [ "${GIT_GUARD_BYPASS:-}" = "1" ]; then
  exec "$REAL_GIT" "$@"
fi

if [ $# -eq 0 ]; then
  exec "$REAL_GIT"
fi

subcommand="$1"
shift || true

case "$subcommand" in
  push | send-pack | receive-pack)
    deny "git $subcommand $*"
    ;;
  branch)
    for arg in "$@"; do
      case "$arg" in
        -D | -D* | -f | --force)
          deny "git branch $*"
          ;;
      esac
    done
    ;;
  reset)
    for arg in "$@"; do
      if [ "$arg" = "--hard" ]; then
        deny "git reset $*"
      fi
    done
    ;;
  clean)
    for arg in "$@"; do
      case "$arg" in
        --force | -f | -f* | -i | --interactive)
          deny "git clean $*"
          ;;
      esac
    done
    ;;
esac

exec "$REAL_GIT" "$subcommand" "$@"
