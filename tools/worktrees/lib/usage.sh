#!/usr/bin/env bash

wt_usage() {
  local default_wt_root
  default_wt_root="$(wt_default_root)"

  cat <<EOF
Usage: tools/worktrees/wt-implement.sh <PRD_PATH> [options]
  <PRD_PATH> must point to an existing tasks/*.md file

Options:
  --wt-root <PATH>           Worktree root directory (default: $default_wt_root)
  --branch-prefix <PREFIX>   Branch prefix (default: feat/)
  --slug <SLUG>              Override inferred slug
  --force-seed               Allow reseeding existing files
  --no-open                  Skip VS Code open attempt
  --print-only               Print computed plan without writing files
  -h, --help                 Show this help message
EOF
}
