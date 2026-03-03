#!/usr/bin/env bash
set -euo pipefail

REAL_GIT="/usr/bin/git"

deny() {
  printf '%s\n' "git-guard: blocked '$*'." >&2
  printf '%s\n' "git-guard: dangerous git pushes and destructive local commands are blocked in devcontainer." >&2
  printf '%s\n' "git-guard: branch push is allowed. Use GIT_GUARD_BYPASS=1 only for explicit one-off override." >&2
  exit 1
}

check_push_args() {
  local arg target

  for arg in "$@"; do
    case "$arg" in
      --force | -f | --force-with-lease | --force-with-lease=* | --mirror | --delete | -d | --all)
        deny "git push $*"
        ;;
      :*)
        deny "git push $*"
        ;;
      *:*)
        target="${arg#*:}"
        case "$target" in
          "" | main | master | refs/heads/main | refs/heads/master)
            deny "git push $*"
            ;;
        esac
        ;;
    esac
  done
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
  push)
    check_push_args "$@"
    ;;
  send-pack | receive-pack)
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
