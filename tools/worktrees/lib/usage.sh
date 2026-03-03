#!/usr/bin/env bash

wt_usage() {
  cat <<'EOF'
Usage: tools/worktrees/wt-implement.sh <PRD_PATH> [options]

Options:
  --wt-root <PATH>           Worktree root directory (default: ../wt)
  --branch-prefix <PREFIX>   Branch prefix (default: feat/)
  --slug <SLUG>              Override inferred slug
  --force-seed               Allow reseeding existing files
  --no-open                  Skip VS Code open attempt
  --print-only               Print computed plan without writing files
  -h, --help                 Show this help message
EOF
}
