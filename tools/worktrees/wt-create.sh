#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/usage.sh
source "$SCRIPT_DIR/lib/usage.sh"

wt_create_usage() {
  cat <<'EOF'
Usage:
  wt-create.sh <BRANCH_NAME> [options]

Description:
  Creates a git worktree for a new or existing branch, runs the canonical
  worktree initialization, and initializes the Ralph submodule.

Arguments:
  <BRANCH_NAME>   Full branch name to create/use (examples: feat/foo, fix/bar)

Options:
  --wt-root <path>   Override worktree root
  --slug <value>     Override worktree folder slug
  --force-seed       Overwrite seedable files
  --no-open          Do not open VS Code
  --print-only       Print resolved values without changing anything
  -h, --help         Show this help
EOF
}

wt_branch_exists_local() {
  local branch_name="$1"
  git show-ref --verify --quiet "refs/heads/$branch_name"
}

wt_branch_exists_remote() {
  local branch_name="$1"
  git show-ref --verify --quiet "refs/remotes/origin/$branch_name"
}

wt_branch_checked_out_elsewhere() {
  local branch_name="$1"

  git worktree list --porcelain | awk -v branch="refs/heads/$branch_name" '
    $1 == "branch" && $2 == branch { found=1 }
    END { exit(found ? 0 : 1) }
  '
}

wt_resolve_slug_from_branch() {
  local branch_name="$1"
  local slug

  slug="${branch_name##*/}"
  slug="$(printf '%s' "$slug" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"

  if [ -z "$slug" ]; then
    wt_error "Could not derive a valid slug from branch: $branch_name"
    return 1
  fi

  printf '%s\n' "$slug"
}

wt_create_or_attach_worktree() {
  local repo_root="$1"
  local worktree_path="$2"
  local branch_name="$3"

  if [ -e "$worktree_path" ]; then
    wt_error "Worktree path already exists: $worktree_path"
    return 1
  fi

  if wt_branch_exists_local "$branch_name"; then
    if wt_branch_checked_out_elsewhere "$branch_name"; then
      wt_error "Branch is already checked out in another worktree: $branch_name"
      return 1
    fi

    git -C "$repo_root" worktree add "$worktree_path" "$branch_name"
    return 0
  fi

  if wt_branch_exists_remote "$branch_name"; then
    git -C "$repo_root" worktree add -b "$branch_name" "$worktree_path" "origin/$branch_name"
    git -C "$worktree_path" branch --set-upstream-to="origin/$branch_name" "$branch_name" >/dev/null 2>&1 || true
    return 0
  fi

  git -C "$repo_root" worktree add -b "$branch_name" "$worktree_path"
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  wt_create_usage
  exit 0
fi

if [ $# -lt 1 ]; then
  wt_error "Missing required argument: <BRANCH_NAME>"
  wt_create_usage
  exit 1
fi

branch_name="$1"
shift

wt_root="$(wt_default_root)"
slug=""
force_seed=0
no_open=0
print_only=0

while [ $# -gt 0 ]; do
  case "$1" in
    --wt-root)
      wt_require_value "--wt-root" "${2:-}"
      wt_root="$2"
      shift 2
      ;;
    --slug)
      wt_require_value "--slug" "${2:-}"
      slug="$2"
      shift 2
      ;;
    --force-seed)
      force_seed=1
      shift
      ;;
    --no-open)
      no_open=1
      shift
      ;;
    --print-only)
      print_only=1
      shift
      ;;
    -h|--help)
      wt_create_usage
      exit 0
      ;;
    *)
      wt_error "Unknown option: $1"
      wt_create_usage
      exit 1
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  wt_error "Current directory is not inside a git repository."
  exit 1
fi

if [ -z "$slug" ]; then
  if ! slug="$(wt_resolve_slug_from_branch "$branch_name")"; then
    exit 1
  fi
fi

worktree_path="$(wt_join_path "$wt_root" "$slug")"

wt_info "wt-create scaffold initialized."
wt_info "Repo root: $repo_root"
wt_info "Worktree root: $wt_root"
wt_info "Slug: $slug"
wt_info "Branch: $branch_name"
wt_info "Worktree path: $worktree_path"
wt_info "force-seed: $force_seed"
wt_info "no-open: $no_open"
wt_info "print-only: $print_only"

if [ "$print_only" -eq 1 ]; then
  wt_info "Print-only mode enabled. No git worktree changes were made."
  exit 0
fi

if ! wt_create_or_attach_worktree "$repo_root" "$worktree_path" "$branch_name"; then
  exit 1
fi

wt_info "Created git worktree: $worktree_path"
wt_info "Checked out branch: $branch_name"

if ! wt_initialize_worktree "$worktree_path" "$force_seed"; then
  exit 1
fi

if ! wt_init_ralph_submodule "$worktree_path"; then
  exit 1
fi

if [ "$no_open" -eq 1 ]; then
  wt_info "Skipping VS Code open (--no-open)."
  exit 0
fi

wt_open_vscode "$worktree_path"
