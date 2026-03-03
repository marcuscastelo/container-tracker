#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/usage.sh
source "$SCRIPT_DIR/lib/usage.sh"

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  wt_usage
  exit 0
fi

if [ $# -lt 1 ]; then
  wt_error "Missing required argument: <PRD_PATH>"
  wt_usage
  exit 1
fi

prd_path="$1"
shift

if ! prd_path="$(wt_validate_prd_path "$prd_path")"; then
  exit 1
fi

wt_root="$(wt_default_root)"
branch_prefix="feat/"
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
    --branch-prefix)
      wt_require_value "--branch-prefix" "${2:-}"
      branch_prefix="$2"
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
      wt_usage
      exit 0
      ;;
    *)
      wt_error "Unknown option: $1"
      wt_usage
      exit 1
      ;;
  esac
done

if ! slug="$(wt_resolve_slug "$prd_path" "$slug")"; then
  exit 1
fi

if ! branch_name="$(wt_build_branch_name "$branch_prefix" "$slug")"; then
  exit 1
fi

worktree_path="$(wt_join_path "$wt_root" "$slug")"

wt_info "wt-implement scaffold initialized."
wt_info "PRD path: $prd_path"
wt_info "Worktree root: $wt_root"
wt_info "Branch prefix: $branch_prefix"
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

if ! wt_create_worktree "$worktree_path" "$branch_name"; then
  exit 1
fi

wt_info "Created git worktree: $worktree_path"
wt_info "Checked out branch: $branch_name"

if ! wt_copy_prd_to_worktree "$prd_path" "$worktree_path"; then
  exit 1
fi

if ! wt_seed_from_allowlist "$worktree_path" "$force_seed"; then
  exit 1
fi

if ! wt_run_pnpm_install "$worktree_path"; then
  exit 1
fi

if [ "$no_open" -eq 1 ]; then
  wt_info "Skipping VS Code open (--no-open)."
  exit 0
fi

wt_open_vscode "$worktree_path"
