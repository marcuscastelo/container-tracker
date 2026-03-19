#!/usr/bin/env bash
set -euo pipefail

# prune-worktrees.sh
#
# Remove git worktrees that are "safe-to-remove":
#   A) Clean (ignoring seeded files) AND no unique commits vs base (never started)
#   B) Clean (ignoring seeded files) AND merged into base
#   C) Clean (ignoring seeded files) AND fully pushed (no local commits ahead of upstream)
#
# Notes:
# - Handles submodules: refuses to prune if any submodule has changes/untracked.
# - Seeded files ignored in cleanliness check:
#     - .env
#     - tasks/prd*.md
#
# Usage:
#   ./prune-worktrees.sh            # dry-run (default)
#   ./prune-worktrees.sh --apply    # actually remove
#   ./prune-worktrees.sh --apply --delete-branch
#   ./prune-worktrees.sh --base origin/main
#
# Run from anywhere inside the repo.

APPLY=0
DELETE_BRANCH=0
VERBOSE=0
BASE_REF="develop"

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --dry-run) APPLY=0; shift ;;
    --delete-branch) DELETE_BRANCH=1; shift ;;
    --base)
      [ $# -ge 2 ] || { echo "Missing value for --base" >&2; exit 2; }
      BASE_REF="$2"; shift 2 ;;
    -v|--verbose) VERBOSE=1; shift ;;
    -h|--help)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "Not inside a git repo." >&2
  exit 1
fi

log() { echo "$*" >&2; }
vlog() { if [ "$VERBOSE" -eq 1 ]; then echo "$*" >&2; fi }

# Resolve base ref (default: origin/HEAD -> origin/main, fallback: origin/main, origin/master, main, master)
resolve_base_ref() {
  if [ -n "$BASE_REF" ]; then
    echo "$BASE_REF"
    return 0
  fi

  local sym
  sym="$(git symbolic-ref -q refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [ -n "$sym" ]; then
    # refs/remotes/origin/main -> origin/main
    echo "${sym#refs/remotes/}"
    return 0
  fi

  for cand in origin/main origin/master main master; do
    if git show-ref --verify --quiet "refs/remotes/$cand" || git show-ref --verify --quiet "refs/heads/$cand"; then
      echo "$cand"
      return 0
    fi
  done

  echo "main"
}

BASE="$(resolve_base_ref)"
log "Base ref: $BASE"
log "Mode: $([ "$APPLY" -eq 1 ] && echo APPLY || echo DRY-RUN)"
log "Ignore for cleanliness: .env, tasks/prd*.md"
log "Submodules: must be clean (no changes/untracked) to prune"

# Pathspec excludes for status checks
EXCLUDES=(
  ":(exclude).env"
  ":(exclude)tasks/prd*.md"
)

is_clean_ignoring_seed() {
  local wt="$1"

  # Root repo clean?
  local out
  out="$(git -C "$wt" status --porcelain --untracked-files=all -- . "${EXCLUDES[@]}" 2>/dev/null || true)"
  if [ -n "$out" ]; then
    vlog "DIRTY (root) in $wt:"
    vlog "$out"
    return 1
  fi

  # Submodules: if any submodule has changes/untracked -> dirty.
  # If submodules are not initialized, treat as clean (we're only pruning clutter).
  if [ -f "$wt/.gitmodules" ] && git -C "$wt" submodule status --recursive >/dev/null 2>&1; then
    # Check each initialized submodule
    # (skip those with '-' status = not initialized)
    local sm_paths
    sm_paths="$(git -C "$wt" submodule status --recursive | awk '$1 ~ /^[+U]/ {print $2}')"
    if [ -n "$sm_paths" ]; then
      # '+' means submodule HEAD differs from index, 'U' conflicts -> dirty
      vlog "DIRTY (submodule pointer) in $wt:"
      vlog "$sm_paths"
      return 1
    fi

    # Now check inside each initialized submodule working dir for changes/untracked
    # (foreach only runs on initialized submodules)
    local sm_dirty=0
    # shellcheck disable=SC2016
    git -C "$wt" submodule foreach --quiet --recursive '
      d="$(git status --porcelain --untracked-files=all 2>/dev/null || true)"
      if [ -n "$d" ]; then
        echo "DIRTY submodule: $name ($path)"
        echo "$d"
        exit 11
      fi
    ' >/tmp/prune_wt_submodule_check.$$ 2>&1 || sm_dirty=$?

    if [ "$sm_dirty" -ne 0 ]; then
      vlog "$(cat /tmp/prune_wt_submodule_check.$$ || true)"
      rm -f /tmp/prune_wt_submodule_check.$$
      return 1
    fi
    rm -f /tmp/prune_wt_submodule_check.$$
  fi

  return 0
}

is_merged_into_base() {
  local wt="$1"
  # HEAD is ancestor of BASE => merged
  git -C "$wt" merge-base --is-ancestor HEAD "$BASE" >/dev/null 2>&1
}

ahead_counts() {
  # prints: "<behind> <ahead>" for A...B where "ahead" is commits in B not in A
  local wt="$1"
  local a="$2"
  local b="$3"
  git -C "$wt" rev-list --left-right --count "$a...$b" 2>/dev/null | awk '{print $1" "$2}'
}

get_upstream() {
  local wt="$1"
  git -C "$wt" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true
}

# Parse worktrees via porcelain (robust)
# We skip:
# - main worktree (repo_root)
# - detached worktrees (no clear branch semantics)
declare -a PRUNE_PATHS=()
declare -a PRUNE_REASONS=()
declare -a PRUNE_BRANCHES=()

current_path=""
current_branch_ref=""
current_detached=0

flush_entry() {
  local p="$current_path"
  local bref="$current_branch_ref"
  local det="$current_detached"

  current_path=""
  current_branch_ref=""
  current_detached=0

  [ -n "$p" ] || return 0

  # Skip main/root worktree
  if [ "$p" = "$repo_root" ]; then
    vlog "Skip root worktree: $p"
    return 0
  fi

  # Skip detached
  if [ "$det" -eq 1 ]; then
    vlog "Skip detached worktree: $p"
    return 0
  fi

  # Need a local branch ref
  if [[ "$bref" != refs/heads/* ]]; then
    vlog "Skip non-local-branch worktree ($bref): $p"
    return 0
  fi

  local branch="${bref#refs/heads/}"

  # Sanity: avoid pruning base branch worktree
  if [ "$branch" = "${BASE#origin/}" ] || [ "$branch" = "$BASE" ]; then
    vlog "Skip base branch worktree ($branch): $p"
    return 0
  fi

  # Clean?
  if ! is_clean_ignoring_seed "$p"; then
    vlog "KEEP (dirty): $p ($branch)"
    return 0
  fi

  # Rule B: merged into base
  if is_merged_into_base "$p"; then
    PRUNE_PATHS+=("$p")
    PRUNE_BRANCHES+=("$branch")
    PRUNE_REASONS+=("merged into $BASE + clean")
    return 0
  fi

  # Rule C: fully pushed (no local commits ahead of upstream)
  local up
  up="$(get_upstream "$p")"
  if [ -n "$up" ]; then
    local counts behind_up ahead_up
    counts="$(ahead_counts "$p" "$up" "HEAD")"
    behind_up="$(awk '{print $1}' <<<"$counts")"
    ahead_up="$(awk '{print $2}' <<<"$counts")"
    vlog "Upstream for $branch: $up (behind=$behind_up ahead=$ahead_up)"
    if [ "$ahead_up" -eq 0 ]; then
      PRUNE_PATHS+=("$p")
      PRUNE_BRANCHES+=("$branch")
      PRUNE_REASONS+=("fully pushed to $up + clean")
      return 0
    fi
  fi

  # Rule A: never started (no unique commits vs base)
  local counts2 behind_base ahead_base
  counts2="$(ahead_counts "$p" "$BASE" "HEAD")"
  behind_base="$(awk '{print $1}' <<<"$counts2")"
  ahead_base="$(awk '{print $2}' <<<"$counts2")"
  vlog "Vs base for $branch: behind=$behind_base ahead=$ahead_base"
  if [ "$ahead_base" -eq 0 ]; then
    PRUNE_PATHS+=("$p")
    PRUNE_BRANCHES+=("$branch")
    PRUNE_REASONS+=("no unique commits vs $BASE + clean")
    return 0
  fi

  vlog "KEEP (has unmerged/unpushed commits): $p ($branch)"
  return 0
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    worktree\ *)
      flush_entry
      current_path="${line#worktree }"
      ;;
    branch\ *)
      current_branch_ref="${line#branch }"
      ;;
    detached)
      current_detached=1
      ;;
    "")
      flush_entry
      ;;
    *)
      : # ignore other fields
      ;;
  esac
done < <(git worktree list --porcelain)
flush_entry

if [ "${#PRUNE_PATHS[@]}" -eq 0 ]; then
  log "No safe-to-remove worktrees found."
  exit 0
fi

log ""
log "Safe-to-remove worktrees:"
for i in "${!PRUNE_PATHS[@]}"; do
  printf -- "  - %s  [%s]  (%s)\n" "${PRUNE_PATHS[$i]}" "${PRUNE_BRANCHES[$i]}" "${PRUNE_REASONS[$i]}" >&2
done

if [ "$APPLY" -eq 0 ]; then
  log ""
  log "Dry-run only. Re-run with: --apply"
  exit 0
fi

log ""
log "Removing worktrees..."
for i in "${!PRUNE_PATHS[@]}"; do
  p="${PRUNE_PATHS[$i]}"
  br="${PRUNE_BRANCHES[$i]}"
  reason="${PRUNE_REASONS[$i]}"

  log "-> git worktree remove --force \"$p\"  # $br ($reason)"
  git worktree remove --force "$p"

  if [ "$DELETE_BRANCH" -eq 1 ]; then
    # Only delete local branch if:
    # - merged into base OR no unique commits vs base (never started)
    if [[ "$reason" == merged\ into* ]] || [[ "$reason" == no\ unique\ commits* ]]; then
      log "   git branch -D \"$br\""
      git branch -D "$br" >/dev/null 2>&1 || true
    else
      log "   (skip branch delete: $br is only 'pushed', not necessarily merged)"
    fi
  fi
done

log ""
log "Pruning stale worktree metadata..."
git worktree prune

log "Done."
