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

wt_is_truthy_env() {
  local value="${1:-}"

  case "$value" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

wt_is_devcontainer() {
  if wt_is_truthy_env "${DEVCONTAINER:-}"; then
    return 0
  fi

  if wt_is_truthy_env "${REMOTE_CONTAINERS:-}"; then
    return 0
  fi

  if [ -n "${REMOTE_CONTAINERS_IPC:-}" ]; then
    return 0
  fi

  if [ -n "${CODESPACES:-}" ]; then
    return 0
  fi

  return 1
}

wt_default_root() {
  if wt_is_devcontainer && [ -n "${HOME:-}" ]; then
    printf '%s\n' "${HOME%/}/wt"
    return 0
  fi

  printf '%s\n' "../wt"
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

wt_slugify() {
  local raw="$1"
  local normalized

  normalized="$(
    printf '%s' "$raw" \
      | tr '[:upper:]' '[:lower:]' \
      | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
  )"

  if [ -z "$normalized" ]; then
    wt_error "Could not derive a valid slug from input: $raw"
    return 1
  fi

  printf '%s\n' "$normalized"
}

wt_derive_slug_from_prd() {
  local prd_path="$1"
  local filename
  local stem

  filename="$(basename "$prd_path")"
  stem="${filename%.md}"
  wt_slugify "$stem"
}

wt_resolve_slug() {
  local prd_path="$1"
  local slug_override="$2"

  if [ -n "$slug_override" ]; then
    wt_slugify "$slug_override"
    return
  fi

  wt_derive_slug_from_prd "$prd_path"
}

wt_build_branch_name() {
  local branch_prefix="$1"
  local slug="$2"

  if [ -z "$branch_prefix" ]; then
    wt_error "Branch prefix must not be empty."
    return 1
  fi

  case "$branch_prefix" in
    */) printf '%s%s\n' "$branch_prefix" "$slug" ;;
    *) printf '%s/%s\n' "$branch_prefix" "$slug" ;;
  esac
}

wt_join_path() {
  local root="$1"
  local leaf="$2"
  local trimmed_root

  if [ "$root" = "/" ]; then
    printf '/%s\n' "$leaf"
    return
  fi

  trimmed_root="${root%/}"
  printf '%s/%s\n' "$trimmed_root" "$leaf"
}

wt_branch_exists() {
  local branch_name="$1"
  git show-ref --verify --quiet "refs/heads/$branch_name"
}

wt_worktree_branch() {
  local worktree_path="$1"
  git -C "$worktree_path" rev-parse --abbrev-ref HEAD 2>/dev/null
}

wt_create_worktree() {
  local worktree_path="$1"
  local branch_name="$2"
  local checked_branch

  if [ -e "$worktree_path" ]; then
    wt_error "Worktree path already exists: $worktree_path"
    wt_error "Choose a different slug (--slug) or worktree root (--wt-root)."
    return 1
  fi

  if wt_branch_exists "$branch_name"; then
    wt_error "Branch already exists: $branch_name"
    wt_error "By default, existing branches are not reused."
    wt_error "Next step: git worktree add \"$worktree_path\" \"$branch_name\""
    return 1
  fi

  if ! git worktree add -b "$branch_name" "$worktree_path"; then
    wt_error "Failed to create worktree at $worktree_path on branch $branch_name."
    return 1
  fi

  if ! checked_branch="$(wt_worktree_branch "$worktree_path")"; then
    wt_error "Created worktree but could not read current branch: $worktree_path"
    return 1
  fi

  if [ "$checked_branch" != "$branch_name" ]; then
    wt_error "Worktree branch mismatch. Expected $branch_name, got $checked_branch."
    return 1
  fi
}

wt_copy_prd_to_worktree() {
  local source_prd_path="$1"
  local worktree_path="$2"
  local repo_root
  local source_abs_path
  local rel_path
  local target_path
  local target_dir

  repo_root="$(wt_repo_root)" || return 1
  source_abs_path="$(wt_abs_path "$source_prd_path")"

  case "$source_abs_path" in
    "$repo_root"/tasks/*)
      rel_path="${source_abs_path#"$repo_root/"}"
      ;;
    *)
      wt_error "PRD source must be under tasks/: $source_prd_path"
      return 1
      ;;
  esac

  target_path="$worktree_path/$rel_path"
  target_dir="$(dirname "$target_path")"

  mkdir -p "$target_dir"

  if ! cp -f "$source_abs_path" "$target_path"; then
    wt_error "Failed to copy PRD into worktree: $rel_path"
    return 1
  fi

  wt_info "PRD copied: $rel_path"
}

wt_seed_allowlist_path() {
  local repo_root

  repo_root="$(wt_repo_root)" || return 1
  printf '%s\n' "$repo_root/tools/worktrees/seed.allowlist"
}

wt_trim_whitespace() {
  local value="$1"
  printf '%s' "$value" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'
}

wt_seed_from_allowlist() {
  local worktree_path="$1"
  local force_seed="${2:-0}"
  local repo_root
  local allowlist

  repo_root="$(wt_repo_root)" || return 1
  allowlist="$(wt_seed_allowlist_path)" || return 1

  if [ ! -f "$allowlist" ]; then
    wt_error "Seed allowlist not found: $allowlist"
    return 1
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    local item
    local source_path
    local target_path
    local target_dir

    item="${line%%#*}"
    item="$(wt_trim_whitespace "$item")"

    if [ -z "$item" ]; then
      continue
    fi

    source_path="$repo_root/$item"
    target_path="$worktree_path/$item"
    target_dir="$(dirname "$target_path")"

    if [ ! -f "$source_path" ]; then
      wt_info "Seed skip (missing source): $item"
      continue
    fi

    if [ -e "$target_path" ] && [ "$force_seed" -ne 1 ]; then
      wt_info "Seed skip (already exists, use --force-seed): $item"
      continue
    fi

    mkdir -p "$target_dir"
    if ! cp -f "$source_path" "$target_path"; then
      wt_error "Failed to seed file: $item"
      return 1
    fi

    wt_info "Seed copied: $item"
  done < "$allowlist"
}

wt_run_pnpm_install() {
  local worktree_path="$1"

  if ! command -v pnpm >/dev/null 2>&1; then
    wt_error "pnpm command not found in PATH."
    return 1
  fi

  wt_info "Running pnpm install in $worktree_path"

  if ! (cd "$worktree_path" && pnpm install); then
    wt_error "pnpm install failed in worktree: $worktree_path"
    return 1
  fi
}

wt_init_ralph_submodule() {
  local worktree_path="$1"

  wt_info "Initializing submodule: tools/ralph-loop"

  if ! git -C "$worktree_path" submodule update --init --recursive tools/ralph-loop; then
    wt_error "Failed to initialize tools/ralph-loop in worktree: $worktree_path"
    return 1
  fi
}

wt_open_vscode() {
  local worktree_path="$1"

  if ! command -v code >/dev/null 2>&1; then
    wt_info "VS Code CLI not found. Open manually: code -n \"$worktree_path\""
    return 0
  fi

  if code -n "$worktree_path"; then
    wt_info "Opened VS Code: $worktree_path"
    return 0
  fi

  wt_info "Could not open VS Code automatically. Open manually: code -n \"$worktree_path\""
  return 0
}

wt_initialize_worktree() {
  local worktree_path="$1"
  local force_seed="${2:-0}"
  local force_overwrite="0"

  if ! command -v pnpm >/dev/null 2>&1; then
    wt_error "pnpm command not found in PATH."
    return 1
  fi

  if [ "$force_seed" -eq 1 ]; then
    force_overwrite="1"
  fi

  wt_info "Running pnpm initialize-worktree in $worktree_path"

  if ! (
    cd "$worktree_path" &&
    INITIALIZE_WORKTREE_FORCE_OVERWRITE="$force_overwrite" pnpm initialize-worktree
  ); then
    wt_error "pnpm initialize-worktree failed in worktree: $worktree_path"
    return 1
  fi
}
