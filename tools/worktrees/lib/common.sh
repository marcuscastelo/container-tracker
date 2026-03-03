#!/usr/bin/env bash

wt_info() {
  printf '%s\n' "$*"
}

wt_error() {
  printf '%s\n' "$*" >&2
}

wt_require_value() {
  local flag="$1"
  local value="${2:-}"

  if [ -z "$value" ]; then
    wt_error "Missing value for $flag"
    return 1
  fi
}

wt_repo_root() {
  if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
    wt_error "Could not detect repository root from current directory."
    return 1
  fi

  git rev-parse --show-toplevel
}

wt_abs_path() {
  local raw_path="$1"
  local file_dir
  local file_name

  file_dir="$(cd "$(dirname "$raw_path")" && pwd -P)"
  file_name="$(basename "$raw_path")"
  printf '%s/%s\n' "$file_dir" "$file_name"
}

wt_validate_prd_path() {
  local raw_path="$1"
  local prd_abs_path
  local repo_root
  local tasks_root

  if [ ! -e "$raw_path" ]; then
    wt_error "PRD file not found: $raw_path"
    return 1
  fi

  if [ ! -f "$raw_path" ]; then
    wt_error "PRD path must be a file: $raw_path"
    return 1
  fi

  case "$raw_path" in
    *.md) ;;
    *)
      wt_error "PRD file must use .md extension: $raw_path"
      return 1
      ;;
  esac

  prd_abs_path="$(wt_abs_path "$raw_path")"
  repo_root="$(wt_repo_root)" || return 1
  tasks_root="$repo_root/tasks"

  case "$prd_abs_path" in
    "$tasks_root"/*)
      printf '%s\n' "$prd_abs_path"
      ;;
    *)
      wt_error "PRD file must be under tasks/: $raw_path"
      return 1
      ;;
  esac
}
