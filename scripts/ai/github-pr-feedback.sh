#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ai/github-pr-feedback.sh <pr-number> [--repo <owner/repo>] [--kind <all|comments|reviews|issue-comments>]

Examples:
  bash scripts/ai/github-pr-feedback.sh 89
  bash scripts/ai/github-pr-feedback.sh 89 --kind comments
  bash scripts/ai/github-pr-feedback.sh 89 --repo marcuscastelo/container-tracker --kind reviews

Notes:
  - Uses `git credential fill` for GitHub auth (no token needed in env).
  - If --repo is omitted, tries to infer from `origin` remote.
EOF
}

if [[ "${1:-}" == "--" ]]; then
  shift
fi

infer_repo_from_origin() {
  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  if [[ "$remote_url" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

PR_NUMBER="$1"
shift

if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "error: <pr-number> must be numeric" >&2
  exit 1
fi

REPO=""
KIND="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --kind)
      KIND="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  REPO="$(infer_repo_from_origin || true)"
fi

if [[ -z "$REPO" ]]; then
  echo "error: could not infer repository. Use --repo <owner/repo>." >&2
  exit 1
fi

case "$KIND" in
  all|comments|reviews|issue-comments) ;;
  *)
    echo "error: --kind must be one of: all, comments, reviews, issue-comments" >&2
    exit 1
    ;;
esac

CREDENTIALS="$(
  printf 'protocol=https\nhost=github.com\npath=%s\n\n' "$REPO" | git credential fill
)"
GITHUB_API_USER="$(printf '%s\n' "$CREDENTIALS" | awk -F= '$1=="username"{print $2}')"
GITHUB_API_PASS="$(printf '%s\n' "$CREDENTIALS" | awk -F= '$1=="password"{print $2}')"

if [[ -z "$GITHUB_API_USER" || -z "$GITHUB_API_PASS" ]]; then
  echo "error: git credential helper did not return github credentials for $REPO" >&2
  exit 1
fi

github_get() {
  # Single-page GET (keeps backwards compat for callers that expect a raw single response)
  local endpoint="$1"
  curl -fsS \
    -u "${GITHUB_API_USER}:${GITHUB_API_PASS}" \
    -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/${REPO}/${endpoint}"
}

github_get_all() {
  # Fetch all pages for an endpoint using per_page=100 paging and concatenate into a single JSON array.
  # Usage: github_get_all "pulls/${PR_NUMBER}/comments"
  local endpoint="$1"
  local page=1
  local per_page=100
  local first=true

  printf '['
  while true; do
    echo "Fetching page $page of ${endpoint}..." >&2
    local url="https://api.github.com/repos/${REPO}/${endpoint}?per_page=${per_page}&page=${page}"
    local resp
    resp=$(curl -fsS -u "${GITHUB_API_USER}:${GITHUB_API_PASS}" -H 'Accept: application/vnd.github+json' "$url") || true
    echo "$resp" | jq empty >/dev/null 2>&1 || break
    echo "Received $(echo "$resp" | jq 'length') items on page $page." >&2

    length=$(echo "$resp" | jq 'length')
    if [[ "$length" -eq 0 ]]; then
      break
    fi
    # if response is empty or an empty array, stop
    if [[ -z "$resp" || "$resp" == "[]" ]]; then
      break
    fi

    if [[ "$first" == true ]]; then
      # print full array for the first page
      printf '%s' "$resp"
      first=false
    else
      # strip surrounding [ and ] from subsequent pages and append elements
      local inner
      inner=$(printf '%s' "$resp" | sed -e 's/^\[//' -e 's/\]$//')
      if [[ -n "$inner" ]]; then
        printf ',%s' "$inner"
      fi
    fi

    ((page++))
  done
  printf ']'
}

if [[ "$KIND" == "comments" ]]; then
  github_get_all "pulls/${PR_NUMBER}/comments"
  exit 0
fi

if [[ "$KIND" == "reviews" ]]; then
  github_get_all "pulls/${PR_NUMBER}/reviews"
  exit 0
fi

if [[ "$KIND" == "issue-comments" ]]; then
  github_get_all "issues/${PR_NUMBER}/comments"
  exit 0
fi

printf '{\n'
printf '  "repo": "%s",\n' "$REPO"
printf '  "pr_number": %s,\n' "$PR_NUMBER"
printf '  "comments": '
github_get_all "pulls/${PR_NUMBER}/comments"
printf ',\n  "reviews": '
github_get_all "pulls/${PR_NUMBER}/reviews"
printf ',\n  "issue_comments": '
github_get_all "issues/${PR_NUMBER}/comments"
printf '\n}\n'
