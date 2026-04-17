#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/ai/ralph.sh [options] <PRD_TEXT>
       <PRD_TEXT> | scripts/ai/ralph.sh [options]

Description:
  Creates a PRD markdown file under tasks/ from full text (argument or stdin)
  and starts Ralph using ai:loop:start.

Options:
  --feature-key <KEY>            Override inferred feature key
  --agent <codex|claude|amp>     Forwarded to ai:loop:start
  --max-iterations <N>           Forwarded to ai:loop:start
  --dangerous-exec <0|1>         Forwarded to ai:loop:start
  --exec-retries <N>             Forwarded to ai:loop:start
  --workdir <DIR>                Forwarded to ai:loop:start
  --prepare-only                 Forwarded to ai:loop:start
  -h, --help                     Show this help

Examples:
  pnpm run ai:ralph -- "# PRD title ... conteúdo completo ..."
  cat tasks/prd-minha-feature.md | pnpm run ai:ralph -- --agent claude
EOF
}

sanitize_feature_key() {
  local raw="$1"
  local key

  key="$(
    printf '%s' "$raw" \
      | tr '[:upper:]' '[:lower:]' \
      | sed -E 's/^[[:space:]#]+//; s/[[:space:]]+$//; s/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g'
  )"

  if [ "${#key}" -gt 60 ]; then
    key="${key:0:60}"
    key="$(printf '%s' "$key" | sed -E 's/-+$//')"
  fi

  printf '%s\n' "$key"
}

extract_prd_title() {
  local prd_text="$1"
  local line
  local trimmed
  local first_non_empty=""

  while IFS= read -r line; do
    trimmed="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"

    if [ -z "$trimmed" ]; then
      continue
    fi

    if [[ "$trimmed" =~ ^#+[[:space:]]+(.+) ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
      return 0
    fi

    if [ -z "$first_non_empty" ]; then
      first_non_empty="$trimmed"
    fi
  done <<< "$prd_text"

  printf '%s\n' "$first_non_empty"
}

derive_feature_key() {
  local prd_text="$1"
  local override="$2"
  local candidate=""
  local fallback

  if [ -n "$override" ]; then
    candidate="$(sanitize_feature_key "$override")"
    if [ -n "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  candidate="$(sanitize_feature_key "$(extract_prd_title "$prd_text")")"
  if [ -n "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  fallback="feature-$(date +%Y%m%d-%H%M%S)"
  printf '%s\n' "$fallback"
}

allocate_prd_path() {
  local feature_key="$1"
  local tasks_dir="$REPO_ROOT/tasks"
  local candidate
  local index=2

  mkdir -p "$tasks_dir"
  candidate="$tasks_dir/prd-$feature_key.md"

  if [ ! -e "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  while [ -e "$tasks_dir/prd-$feature_key-$index.md" ]; do
    index=$((index + 1))
  done

  printf '%s\n' "$tasks_dir/prd-$feature_key-$index.md"
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

feature_key_override=""
start_args=()
prd_args=()

while [ $# -gt 0 ]; do
  case "$1" in
    --feature-key)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for --feature-key"
        exit 1
      fi
      feature_key_override="$2"
      shift 2
      ;;
    --agent|--max-iterations|--dangerous-exec|--exec-retries|--workdir)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for $1"
        exit 1
      fi
      start_args+=("$1" "$2")
      shift 2
      ;;
    --prepare-only)
      start_args+=("$1")
      shift
      ;;
    --)
      shift
      while [ $# -gt 0 ]; do
        prd_args+=("$1")
        shift
      done
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      prd_args+=("$1")
      shift
      ;;
  esac
done

stdin_text=""
if [ ! -t 0 ]; then
  stdin_text="$(cat)"
fi

args_text=""
if [ "${#prd_args[@]}" -gt 0 ]; then
  args_text="${prd_args[*]}"
fi

if [ -n "$stdin_text" ] && [ -n "$args_text" ]; then
  rl_error "Provide PRD text either by argument or stdin, not both."
  exit 1
fi

prd_text="$stdin_text"
if [ -z "$prd_text" ]; then
  prd_text="$args_text"
fi

if ! printf '%s' "$prd_text" | grep -q '[^[:space:]]'; then
  rl_error "Missing PRD text."
  usage
  exit 1
fi

feature_key="$(derive_feature_key "$prd_text" "$feature_key_override")"
prd_path="$(allocate_prd_path "$feature_key")"

printf '%s\n' "$prd_text" > "$prd_path"

rl_info "Saved PRD markdown: $prd_path"
rl_info "Resolved feature key: $feature_key"

bash "$SCRIPT_DIR/ralph-loop-start.sh" "$feature_key" "$prd_path" "${start_args[@]}"
