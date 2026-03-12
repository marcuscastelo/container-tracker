#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  generate_pr_draft.sh [--base <branch>] [--repo <path>] [--outdir <path>]

Options:
  --base   Base branch to compare against (default: main)
  --repo   Repository path (default: current directory)
  --outdir Output directory for generated files (default: /tmp)
USAGE
}

require_option_value() {
  local opt="$1"
  local argc="$2"
  if ((argc < 2)); then
    echo "Error: ${opt} requires a value." >&2
    usage >&2
    exit 2
  fi
}

BASE_BRANCH="main"
REPO_DIR="$(pwd)"
OUTDIR="/tmp"

while (($# > 0)); do
  case "$1" in
    --base)
      require_option_value "--base" $#
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --repo)
      require_option_value "--repo" $#
      REPO_DIR="${2:-}"
      shift 2
      ;;
    --outdir)
      require_option_value "--outdir" $#
      OUTDIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$BASE_BRANCH" || -z "$REPO_DIR" || -z "$OUTDIR" ]]; then
  echo "Invalid empty option value." >&2
  exit 2
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 2
fi

if ! git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Repository path is not a git repository: $REPO_DIR" >&2
  exit 2
fi

mkdir -p "$OUTDIR"

cd "$REPO_DIR"

resolve_base_ref() {
  local base="$1"
  if git show-ref --verify --quiet "refs/heads/$base"; then
    printf '%s' "$base"
    return 0
  fi

  if git show-ref --verify --quiet "refs/remotes/origin/$base"; then
    printf 'origin/%s' "$base"
    return 0
  fi

  return 1
}

BASE_REF="$(resolve_base_ref "$BASE_BRANCH" || true)"
if [[ -z "$BASE_REF" ]]; then
  echo "Base branch not found locally: $BASE_BRANCH" >&2
  echo "Expected refs/heads/$BASE_BRANCH or refs/remotes/origin/$BASE_BRANCH" >&2
  exit 2
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" == "HEAD" ]]; then
  CURRENT_BRANCH="detached-$(git rev-parse --short HEAD)"
fi

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD)"

mapfile -t COMMIT_SUBJECTS < <(git log --reverse --pretty=format:%s "$BASE_REF..HEAD")
mapfile -t COMMIT_LINES < <(git log --reverse --pretty=format:'- %s (%h)' "$BASE_REF..HEAD")
mapfile -t CHANGED_FILES < <(git diff --name-status "$BASE_REF...HEAD")

COMMIT_COUNT="${#COMMIT_SUBJECTS[@]}"
FILE_COUNT="${#CHANGED_FILES[@]}"

infer_prefix() {
  local branch="$1"
  case "$branch" in
    feat/*|feature/*) printf 'feat: ' ;;
    fix/*|bugfix/*|hotfix/*) printf 'fix: ' ;;
    refactor/*) printf 'refactor: ' ;;
    docs/*|doc/*) printf 'docs: ' ;;
    test/*|tests/*) printf 'test: ' ;;
    perf/*) printf 'perf: ' ;;
    chore/*|ci/*|build/*) printf 'chore: ' ;;
    *) printf '' ;;
  esac
}

infer_branch_subject() {
  local branch="$1"
  local subject="$branch"

  for p in feat feature fix bugfix hotfix refactor docs doc test tests perf chore ci build; do
    if [[ "$subject" == "$p/"* ]]; then
      subject="${subject#"$p/"}"
      break
    fi
  done

  subject="${subject//\// }"
  subject="${subject//-/ }"
  subject="${subject//_/ }"
  subject="$(printf '%s' "$subject" | tr -s ' ' | sed 's/^ *//; s/ *$//')"

  if [[ -z "$subject" ]]; then
    subject="update ${branch}"
  fi

  printf '%s' "$subject"
}

infer_title() {
  if (( COMMIT_COUNT == 1 )); then
    printf '%s' "${COMMIT_SUBJECTS[0]}"
    return
  fi

  local prefix
  local subject
  prefix="$(infer_prefix "$CURRENT_BRANCH")"
  subject="$(infer_branch_subject "$CURRENT_BRANCH")"

  if [[ -n "$prefix" ]]; then
    printf '%s%s' "$prefix" "$subject"
  elif (( COMMIT_COUNT > 0 )); then
    printf '%s' "${COMMIT_SUBJECTS[0]}"
  else
    printf 'chore: sync %s' "$CURRENT_BRANCH"
  fi
}

PR_TITLE="$(infer_title)"

slugify() {
  local v="$1"
  v="${v//\//-}"
  v="${v// /-}"
  v="$(printf '%s' "$v" | tr -cd '[:alnum:]._-')"
  if [[ -z "$v" ]]; then
    v="branch"
  fi
  printf '%s' "$v"
}

SLUG="$(slugify "$CURRENT_BRANCH")"
TITLE_PATH="$OUTDIR/pr-${SLUG}-title.txt"
DESCRIPTION_PATH="$OUTDIR/pr-${SLUG}-description.md"

DIFFSTAT="$(git diff --stat "$BASE_REF...HEAD")"

printf '%s\n' "$PR_TITLE" > "$TITLE_PATH"

{
  printf '## Summary\n\n'
  if (( COMMIT_COUNT == 0 )); then
    printf 'No commits found between `%s` and `HEAD`.\n\n' "$BASE_REF"
  else
    printf 'Compare `%s` -> `%s` with `%s` commit(s) and `%s` changed file(s).\n\n' \
      "$BASE_REF" "$CURRENT_BRANCH" "$COMMIT_COUNT" "$FILE_COUNT"
  fi

  printf '## Context\n\n'
  printf '%s\n' "- Current branch: \`$CURRENT_BRANCH\`"
  printf '%s\n' "- Base branch: \`$BASE_REF\`"
  printf '%s\n\n' "- Merge base: \`$MERGE_BASE\`"

  printf '## Commits\n\n'
  if (( COMMIT_COUNT == 0 )); then
    printf '%s\n\n' '- (none)'
  else
    printf '%s\n' "${COMMIT_LINES[@]}"
    printf '\n'
  fi

  printf '## Files Changed\n\n'
  if (( FILE_COUNT == 0 )); then
    printf '%s\n\n' '- (none)'
  else
    printf '```text\n'
    printf '%s\n' "${CHANGED_FILES[@]}"
    printf '```\n\n'
  fi

  printf '## Diffstat\n\n'
  printf '```text\n'
  if [[ -n "$DIFFSTAT" ]]; then
    printf '%s\n' "$DIFFSTAT"
  else
    printf '(no diffstat)\n'
  fi
  printf '```\n\n'

  printf '## Validation\n\n'
  printf '%s\n' '- [ ] Run `pnpm flint`'
  printf '%s\n' '- [ ] Run `pnpm test`'
} > "$DESCRIPTION_PATH"

printf 'TITLE_PATH=%s\n' "$TITLE_PATH"
printf 'DESCRIPTION_PATH=%s\n' "$DESCRIPTION_PATH"
printf '\n=== TITLE ===\n'
cat "$TITLE_PATH"
printf '\n\n=== DESCRIPTION ===\n'
cat "$DESCRIPTION_PATH"
printf '\n'
