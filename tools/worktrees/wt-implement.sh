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

wt_root="../wt"
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

wt_info "wt-implement scaffold initialized."
wt_info "PRD path: $prd_path"
wt_info "Worktree root: $wt_root"
wt_info "Branch prefix: $branch_prefix"
wt_info "Slug override: ${slug:-<auto>}"
wt_info "force-seed: $force_seed"
wt_info "no-open: $no_open"
wt_info "print-only: $print_only"
