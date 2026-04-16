#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ralph-loop-common.sh
source "$SCRIPT_DIR/ralph-loop-common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/ai/ralph-loop-start.sh <FEATURE_KEY> <PRD_SOURCE> [options]

PRD_SOURCE:
  - Markdown file path (recommended)
  - JSON file path (already in Ralph schema)
  - Plain text prompt

Options:
  --agent <codex|claude|amp>    Override RALPH_AGENT
  --max-iterations <N>          Override RALPH_MAX_ITERATIONS
  --dangerous-exec <0|1>        Override RALPH_ALLOW_DANGEROUS_EXEC
  --exec-retries <N>            Retry count for exec failures (default: 2)
  --workdir <DIR>               Override feature workdir (default: .ralph-loop/<FEATURE_KEY>)
  --prepare-only                Generate prd.json + input.json only (do not run exec)
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ $# -lt 2 ]; then
  usage
  exit 1
fi

feature_key="$1"
prd_source="$2"
shift 2

prepare_only=0
exec_retries=2
feature_dir="${RALPH_LOOP_WORKDIR%/}/$feature_key"

while [ $# -gt 0 ]; do
  case "$1" in
    --agent)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for --agent"
        exit 1
      fi
      export RALPH_AGENT="$2"
      shift 2
      ;;
    --max-iterations)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for --max-iterations"
        exit 1
      fi
      export RALPH_MAX_ITERATIONS="$2"
      shift 2
      ;;
    --dangerous-exec)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for --dangerous-exec"
        exit 1
      fi
      export RALPH_ALLOW_DANGEROUS_EXEC="$2"
      shift 2
      ;;
    --exec-retries)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for --exec-retries"
        exit 1
      fi
      exec_retries="$2"
      shift 2
      ;;
    --workdir)
      if [ $# -lt 2 ]; then
        rl_error "Missing value for --workdir"
        exit 1
      fi
      feature_dir="$2"
      shift 2
      ;;
    --prepare-only)
      prepare_only=1
      shift
      ;;
    *)
      rl_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [ -z "$feature_key" ]; then
  rl_error "FEATURE_KEY cannot be empty."
  exit 1
fi

if ! [[ "$exec_retries" =~ ^[0-9]+$ ]]; then
  rl_error "--exec-retries must be a non-negative integer."
  exit 1
fi

if [ "$RALPH_ALLOW_DANGEROUS_EXEC" != "0" ] && [ "$RALPH_ALLOW_DANGEROUS_EXEC" != "1" ]; then
  rl_error "--dangerous-exec must be 0 or 1."
  exit 1
fi

ensure_loop_assets
ensure_agent_cli

mkdir -p "$feature_dir"
feature_dir="$(abs_path "$feature_dir")"

plan_json="$feature_dir/prd.json"
progress_file="$feature_dir/progress.txt"
input_json="$feature_dir/input.json"

source_path=""
if [ -f "$prd_source" ]; then
  source_path="$(abs_path "$prd_source")"
fi

if [ -n "$source_path" ] && jq empty "$source_path" >/dev/null 2>&1; then
  cp "$source_path" "$plan_json"
  rl_info "Using provided PRD JSON: $source_path"
else
  rl_info "Planning phase started for feature: $feature_key"

  if [ -n "$source_path" ]; then
    cp "$source_path" "$feature_dir/prd.md"
    rl_info "Saved PRD markdown copy: $feature_dir/prd.md"
  fi

  bash "$SCRIPT_DIR/ralph-loop-plan.sh" "$prd_source" "$plan_json"
fi

rl_info "Building Ralph execution input for feature: $feature_key"
bash "$SCRIPT_DIR/ralph-loop-make-input.sh" "$plan_json" "$progress_file" "$input_json"

if [ "$prepare_only" = "1" ]; then
  rl_info "Prepared Ralph files only:"
  rl_info "- $plan_json"
  rl_info "- $input_json"
  rl_info "- $progress_file"
  exit 0
fi

max_attempts=$((exec_retries + 1))
attempt=1
while [ "$attempt" -le "$max_attempts" ]; do
  rl_info "Starting Ralph exec attempt $attempt/$max_attempts"

  if bash "$SCRIPT_DIR/ralph-loop-exec.sh" "$input_json"; then
    rl_info "Ralph start flow completed successfully."
    exit 0
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    rl_error "Ralph exec failed after $max_attempts attempts."
    exit 1
  fi

  rl_error "Ralph exec failed on attempt $attempt. Retrying in 5s..."
  sleep 5
  attempt=$((attempt + 1))
done
