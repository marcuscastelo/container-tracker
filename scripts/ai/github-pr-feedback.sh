#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ai/github-pr-feedback.sh <pr-number> [--repo <owner/repo>] [--kind <all|comments|reviews|issue-comments>] [--raw]
  bash scripts/ai/github-pr-feedback.sh <pr-number> [--repo <owner/repo>] --resolve <thread-id[,thread-id,...]>
  bash scripts/ai/github-pr-feedback.sh <pr-number> [--repo <owner/repo>] --resolve-file <file>

Examples:
  bash scripts/ai/github-pr-feedback.sh 89
  bash scripts/ai/github-pr-feedback.sh 89 --kind comments
  bash scripts/ai/github-pr-feedback.sh 89 --repo marcuscastelo/container-tracker --kind reviews
  bash scripts/ai/github-pr-feedback.sh 89 --resolve PRRT_kwDO...,PRRT_kwDO...
  bash scripts/ai/github-pr-feedback.sh 89 --resolve-file /tmp/approved-thread-ids.txt

Resolve file format:
  - One thread id per line
  - Blank lines ignored
  - Lines starting with # ignored

Notes:
  - Uses `git credential fill` for GitHub auth.
  - If --repo is omitted, tries to infer from `origin` remote.
  - Default mode renders a prompt for LLM copy/paste.
  - Resolve uses GraphQL review thread resolution.
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
RAW_MODE=0
RESOLVE_IDS=()
RESOLVE_FILE=""

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
    --raw)
      RAW_MODE=1
      shift
      ;;
    --resolve)
      IFS=',' read -r -a _ids <<< "${2:-}"
      for _id in "${_ids[@]}"; do
        [[ -n "${_id// }" ]] && RESOLVE_IDS+=("$_id")
      done
      shift 2
      ;;
    --resolve-file)
      RESOLVE_FILE="${2:-}"
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

if [[ -n "$RESOLVE_FILE" ]]; then
  if [[ ! -f "$RESOLVE_FILE" ]]; then
    echo "error: resolve file not found: $RESOLVE_FILE" >&2
    exit 1
  fi
  while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^# ]] && continue
    RESOLVE_IDS+=("$line")
  done < "$RESOLVE_FILE"
fi

CREDENTIALS="$(
  printf 'protocol=https\nhost=github.com\npath=%s\n\n' "$REPO" | git credential fill
)"
GITHUB_API_USER="$(printf '%s\n' "$CREDENTIALS" | awk -F= '$1=="username"{print $2}')"
GITHUB_API_PASS="$(printf '%s\n' "$CREDENTIALS" | awk -F= '$1=="password"{print $2}')"

if [[ -z "$GITHUB_API_USER" || -z "$GITHUB_API_PASS" ]]; then
  echo "error: git credential helper did not return github credentials for $REPO" >&2
  exit 1
fi

OWNER="${REPO%/*}"
REPO_NAME="${REPO#*/}"

github_get_all() {
  local endpoint="$1"
  local page=1
  local per_page=100
  local first=true

  printf '['
  while true; do
    local url="https://api.github.com/repos/${REPO}/${endpoint}?per_page=${per_page}&page=${page}"
    local resp
    resp="$(curl -fsS \
      -u "${GITHUB_API_USER}:${GITHUB_API_PASS}" \
      -H 'Accept: application/vnd.github+json' \
      "$url" 2>/dev/null || true)"

    if ! printf '%s' "$resp" | jq empty >/dev/null 2>&1; then
      break
    fi

    local length
    length="$(printf '%s' "$resp" | jq 'length')"
    if [[ "$length" -eq 0 ]]; then
      break
    fi

    local inner
    inner="$(printf '%s' "$resp" | jq -c '.[]')"

    if [[ -n "$inner" ]]; then
      while IFS= read -r item; do
        [[ -z "$item" ]] && continue
        if [[ "$first" == true ]]; then
          printf '%s' "$item"
          first=false
        else
          printf ',%s' "$item"
        fi
      done <<< "$inner"
    fi

    ((page++))
  done
  printf ']'
}

json_or_default() {
  local payload="${1:-}"
  local fallback="${2:-[]}"

  if [[ -z "$payload" ]]; then
    printf '%s\n' "$fallback"
    return
  fi

  if printf '%s' "$payload" | jq empty >/dev/null 2>&1; then
    printf '%s\n' "$payload"
  else
    printf '%s\n' "$fallback"
  fi
}

graphql_query() {
  local query="$1"
  local variables_json="${2:-{}}"

  if [[ -z "$variables_json" ]]; then
    variables_json='{}'
  fi

  if ! printf '%s' "$variables_json" | jq empty >/dev/null 2>&1; then
    # Defensive recovery for the intermittent "extra trailing brace" case
    # observed in some shells/environments while building vars JSON.
    local maybe_trimmed="${variables_json%?}"
    if [[ "$variables_json" == *"}" ]] && printf '%s' "$maybe_trimmed" | jq empty >/dev/null 2>&1; then
      variables_json="$maybe_trimmed"
    else
      echo "error: invalid GraphQL variables JSON" >&2
      printf '%s\n' "$variables_json" >&2
      exit 1
    fi
  fi

  jq -nc \
    --arg query "$query" \
    --argjson variables "$variables_json" \
    '{query:$query, variables:$variables}' |
  curl -fsS \
    -u "${GITHUB_API_USER}:${GITHUB_API_PASS}" \
    -H 'Accept: application/vnd.github+json' \
    -H 'Content-Type: application/json' \
    https://api.github.com/graphql \
    -d @-
}

graphql_check_no_errors() {
  local payload="$1"

  if ! printf '%s' "$payload" | jq empty >/dev/null 2>&1; then
    echo "error: invalid GraphQL response JSON" >&2
    printf '%s\n' "$payload" >&2
    exit 1
  fi

  local has_errors
  has_errors="$(printf '%s' "$payload" | jq 'has("errors")')"
  if [[ "$has_errors" == "true" ]]; then
    echo "error: GitHub GraphQL returned errors" >&2
    printf '%s' "$payload" | jq . >&2
    exit 1
  fi
}

fetch_all_review_threads() {
  local after=""
  local first=true

  local query='
query($owner:String!, $name:String!, $number:Int!, $after:String) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      reviewThreads(first:100, after:$after) {
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first:100) {
            nodes {
              databaseId
              id
              body
              path
              url
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}'

  printf '['
  while true; do
    local vars
    if [[ -z "$after" ]]; then
      vars="$(jq -nc \
        --arg owner "$OWNER" \
        --arg name "$REPO_NAME" \
        --argjson number "$PR_NUMBER" \
        '{owner:$owner, name:$name, number:$number, after:null}'
      )"
    else
      vars="$(jq -nc \
        --arg owner "$OWNER" \
        --arg name "$REPO_NAME" \
        --argjson number "$PR_NUMBER" \
        --arg after "$after" \
        '{owner:$owner, name:$name, number:$number, after:$after}'
      )"
    fi

    local resp
    resp="$(graphql_query "$query" "$vars")"
    graphql_check_no_errors "$resp"

    local chunk
    chunk="$(printf '%s' "$resp" | jq -c '.data.repository.pullRequest.reviewThreads.nodes[]')"

    if [[ -n "$chunk" ]]; then
      while IFS= read -r item; do
        [[ -z "$item" ]] && continue
        if [[ "$first" == true ]]; then
          printf '%s' "$item"
          first=false
        else
          printf ',%s' "$item"
        fi
      done <<< "$chunk"
    fi

    local has_next
    has_next="$(printf '%s' "$resp" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')"
    if [[ "$has_next" != "true" ]]; then
      break
    fi

    after="$(printf '%s' "$resp" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty')"
    [[ "$after" == "null" ]] && after=""
  done
  printf ']'
}

resolve_review_thread() {
  local thread_id="$1"
  local mutation='
mutation($threadId:ID!) {
  resolveReviewThread(input:{threadId:$threadId}) {
    thread {
      id
      isResolved
    }
  }
}'
  local vars
  vars="$(jq -cn --arg threadId "$thread_id" '{threadId:$threadId}')"
  local resp
  resp="$(graphql_query "$mutation" "$vars")"
  graphql_check_no_errors "$resp"

  local resolved
  resolved="$(echo "$resp" | jq -r '.data.resolveReviewThread.thread.isResolved')"
  if [[ "$resolved" == "true" ]]; then
    echo "resolved $thread_id" >&2
  else
    echo "warning: thread not resolved $thread_id" >&2
  fi
}

resolve_threads() {
  local threads_json
  threads_json="$(fetch_all_review_threads)"

  local unique_ids
  unique_ids="$(printf '%s\n' "${RESOLVE_IDS[@]}" | sed '/^[[:space:]]*$/d' | sort -u)"

  if [[ -z "$unique_ids" ]]; then
    echo "error: no thread ids provided to resolve" >&2
    exit 1
  fi

  while IFS= read -r resolve_id; do
    [[ -z "$resolve_id" ]] && continue

    local thread_id="$resolve_id"
    if [[ "$resolve_id" =~ ^[0-9]+$ ]]; then
      # Allow --resolve with review_comment_id by mapping comment -> thread.
      thread_id="$(
        echo "$threads_json" |
        jq -r --argjson comment_id "$resolve_id" '
          .[]
          | select(any(.comments.nodes[]?; .databaseId == $comment_id))
          | .id
        ' | head -n 1
      )"
      if [[ -z "$thread_id" || "$thread_id" == "null" ]]; then
        echo "warning: review comment id not found in PR #${PR_NUMBER}: $resolve_id" >&2
        continue
      fi
    fi

    local exists
    exists="$(echo "$threads_json" | jq --arg id "$thread_id" 'map(select(.id == $id)) | length')"
    if [[ "$exists" -eq 0 ]]; then
      echo "warning: thread id not found in PR #${PR_NUMBER}: $thread_id (from $resolve_id)" >&2
      continue
    fi

    local already_resolved
    already_resolved="$(echo "$threads_json" | jq -r --arg id "$thread_id" '.[] | select(.id == $id) | .isResolved')"
    if [[ "$already_resolved" == "true" ]]; then
      echo "already resolved $thread_id" >&2
      continue
    fi

    resolve_review_thread "$thread_id"
  done <<< "$unique_ids"
}

render_prompt() {
  local comments_json="$1"
  local reviews_json="$2"
  local issue_comments_json="$3"
  local threads_json="$4"

  local tmpdir
  tmpdir="$(mktemp -d)"

  printf '%s' "$comments_json" > "$tmpdir/comments.json"
  printf '%s' "$reviews_json" > "$tmpdir/reviews.json"
  printf '%s' "$issue_comments_json" > "$tmpdir/issue_comments.json"

  local jq_status=0
  jq -rn \
    --arg repo "$REPO" \
    --arg pr "$PR_NUMBER" \
    --slurpfile comments "$tmpdir/comments.json" \
    --slurpfile reviews "$tmpdir/reviews.json" \
    --slurpfile issue_comments "$tmpdir/issue_comments.json" \
'
($comments[0] // []) as $comments
| ($reviews[0] // []) as $reviews
| ($issue_comments[0] // []) as $issue_comments
|
def norm:
  gsub("\r\n"; "\n")
  | gsub("\r"; "\n")
  | gsub("\n{3,}"; "\n\n")
  | sub("^\n+"; "")
  | sub("\n+$"; "");

def is_bot_login($login):
  ($login // "") as $v
  | ($v | ascii_downcase) as $s
  | ($s == "github-actions[bot]")
    or ($s == "copilot-pull-request-reviewer[bot]")
    or ($s == "vercel")
    or ($s == "vercel[bot]");

def is_noise_issue_comment:
  ((.body // "") | startswith("[vc]:"));

def block($path; $body; $meta):
  ($path + "\n" + $meta + "\n" + ($body | norm));

(
  [
    $comments[]
    | select((.body // "") != "" and (.path // "") != "")
    | select(is_bot_login(.user.login) | not)
    | block(
        .path;
        .body;
        ("[review_comment_id: " + (.id | tostring) + "]")
      )
  ]
  +
  [
    $reviews[]
    | select((.body // "") != "")
    | select(is_bot_login(.user.login) | not)
    | block(
        ("[general review · " + ((.state // "REVIEW") | ascii_downcase) + "]");
        .body;
        ("[review_id: " + (.id | tostring) + "]")
      )
  ]
  +
  [
    $issue_comments[]
    | select((.body // "") != "")
    | select(is_bot_login(.user.login) | not)
    | select(is_noise_issue_comment | not)
    | block(
        "[issue comment]";
        .body;
        ("[issue_comment_id: " + (.id | tostring) + "]")
      )
  ]
)
| unique
| sort
| join("\n\n")
+ "\n\n====\n"
+ "Avalie quais feedbacks sao validos e quais sao falta de entendimento do reviewer. Implemente os feedbacks validos\n"
+ "Após implementar os válidos, use o comando `bash scripts/ai/github-pr-feedback.sh \($pr) --repo \($repo) --resolve <review-comment-id-1>,<review-comment-id-2>` para marcar como resolved. Mantenha os rejeitados unresolved.\n"
+ "====\n"
+ "Adicione testes para evitar regressao ao corrigir logica complicada ou detalhada\n"
+ "`pnpm check` green ao fim da implementacao\n"
+ "Commite com `chore(pr): apply PR #\($pr) suggestions`\n"
'
  jq_status=$?
  rm -rf "$tmpdir"
  return "$jq_status"
}

if [[ ${#RESOLVE_IDS[@]} -gt 0 ]]; then
  resolve_threads
  exit 0
fi

if [[ "$KIND" == "comments" && "$RAW_MODE" -eq 1 ]]; then
  github_get_all "pulls/${PR_NUMBER}/comments"
  exit 0
fi

if [[ "$KIND" == "reviews" && "$RAW_MODE" -eq 1 ]]; then
  github_get_all "pulls/${PR_NUMBER}/reviews"
  exit 0
fi

if [[ "$KIND" == "issue-comments" && "$RAW_MODE" -eq 1 ]]; then
  github_get_all "issues/${PR_NUMBER}/comments"
  exit 0
fi

if [[ "$RAW_MODE" -eq 1 ]]; then
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
  exit 0
fi

COMMENTS_JSON='[]'
REVIEWS_JSON='[]'
ISSUE_COMMENTS_JSON='[]'
THREADS_JSON='[]'

if [[ "$KIND" == "all" || "$KIND" == "comments" ]]; then
  COMMENTS_JSON="$(json_or_default "$(github_get_all "pulls/${PR_NUMBER}/comments" || true)" '[]')"
fi

if [[ "$KIND" == "all" || "$KIND" == "reviews" ]]; then
  REVIEWS_JSON="$(json_or_default "$(github_get_all "pulls/${PR_NUMBER}/reviews" || true)" '[]')"
fi

if [[ "$KIND" == "all" || "$KIND" == "issue-comments" ]]; then
  ISSUE_COMMENTS_JSON="$(json_or_default "$(github_get_all "issues/${PR_NUMBER}/comments" || true)" '[]')"
fi

render_prompt "$COMMENTS_JSON" "$REVIEWS_JSON" "$ISSUE_COMMENTS_JSON" "$THREADS_JSON"
