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
