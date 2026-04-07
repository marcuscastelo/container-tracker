#!/usr/bin/env bash
set -euo pipefail

if [ "${OSTYPE:-}" = "msys" ] || [ "${OSTYPE:-}" = "cygwin" ] || [ "${OSTYPE:-}" = "win32" ]; then
  echo "[agent:run] This command is Linux/macOS only."
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
project_env_path="$repo_root/.env"

agent_data_dir="${AGENT_DATA_DIR:-$repo_root/.agent-runtime}"
dotenv_path="${DOTENV_PATH:-$agent_data_dir/config.env}"
bootstrap_path="${BOOTSTRAP_DOTENV_PATH:-$agent_data_dir/bootstrap.env}"
disable_automatic_update_checks="${AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS:-}"
register_path="$repo_root/tools/agent/dist/tools/agent/runtime/register-alias-loader.js"
node_args=("tools/agent/dist/tools/agent/supervisor.js")

mkdir -p "$agent_data_dir"

trim_value() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  if [ "${#value}" -ge 2 ] && [ "${value:0:1}" = '"' ] && [ "${value: -1}" = '"' ]; then
    value="${value:1:${#value}-2}"
  elif [ "${#value}" -ge 2 ] && [ "${value:0:1}" = "'" ] && [ "${value: -1}" = "'" ]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

read_env_value() {
  local file_path="$1"
  local key
  shift

  [ -f "$file_path" ] || return 1

  for key in "$@"; do
    local raw
    raw="$(awk -v key="$key" '
      /^[[:space:]]*#/ { next }
      {
        line = $0
        sub(/^[[:space:]]+/, "", line)
        if (index(line, key "=") == 1) {
          print substr(line, length(key) + 2)
          exit
        }
      }
    ' "$file_path")"

    if [ -n "$raw" ]; then
      trim_value "$raw"
      return 0
    fi
  done

  return 1
}

first_non_empty() {
  local value
  for value in "$@"; do
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
  done

  printf ''
  return 0
}

if [ ! -f "$dotenv_path" ] && [ ! -f "$bootstrap_path" ]; then
  backend_url="$(first_non_empty \
    "$(read_env_value "$project_env_path" BACKEND_URL AGENT_BACKEND_URL || true)" \
    "$(read_env_value "$bootstrap_path" BACKEND_URL AGENT_BACKEND_URL || true)" \
    "$(read_env_value "$dotenv_path" BACKEND_URL AGENT_BACKEND_URL || true)" \
    "${AGENT_BACKEND_URL:-}" \
    "${BACKEND_URL:-}")"
  installer_token="$(first_non_empty \
    "$(read_env_value "$project_env_path" INSTALLER_TOKEN AGENT_INSTALLER_TOKEN || true)" \
    "$(read_env_value "$bootstrap_path" INSTALLER_TOKEN AGENT_INSTALLER_TOKEN || true)" \
    "$(read_env_value "$dotenv_path" INSTALLER_TOKEN AGENT_INSTALLER_TOKEN || true)" \
    "${AGENT_INSTALLER_TOKEN:-}" \
    "${INSTALLER_TOKEN:-}")"
  update_manifest_channel="$(first_non_empty \
    "${AGENT_UPDATE_MANIFEST_CHANNEL:-}" \
    "$(read_env_value "$project_env_path" AGENT_UPDATE_MANIFEST_CHANNEL || true)" \
    "$(read_env_value "$bootstrap_path" AGENT_UPDATE_MANIFEST_CHANNEL || true)" \
    "$(read_env_value "$dotenv_path" AGENT_UPDATE_MANIFEST_CHANNEL || true)" \
    "stable")"

  if [ -n "$backend_url" ] && [ -n "$installer_token" ]; then
    agent_id="$(first_non_empty \
      "$(read_env_value "$project_env_path" AGENT_ID || true)" \
      "$(read_env_value "$bootstrap_path" AGENT_ID || true)" \
      "$(read_env_value "$dotenv_path" AGENT_ID || true)" \
      "${AGENT_ID:-}" \
      "container-tracker-agent")"
    interval_sec="$(first_non_empty \
      "$(read_env_value "$project_env_path" INTERVAL_SEC AGENT_ENROLL_DEFAULT_INTERVAL_SEC || true)" \
      "$(read_env_value "$bootstrap_path" INTERVAL_SEC AGENT_ENROLL_DEFAULT_INTERVAL_SEC || true)" \
      "$(read_env_value "$dotenv_path" INTERVAL_SEC AGENT_ENROLL_DEFAULT_INTERVAL_SEC || true)" \
      "60")"
    limit_value="$(first_non_empty \
      "$(read_env_value "$project_env_path" LIMIT AGENT_ENROLL_DEFAULT_LIMIT || true)" \
      "$(read_env_value "$bootstrap_path" LIMIT AGENT_ENROLL_DEFAULT_LIMIT || true)" \
      "$(read_env_value "$dotenv_path" LIMIT AGENT_ENROLL_DEFAULT_LIMIT || true)" \
      "10")"
    maersk_enabled="$(first_non_empty \
      "$(read_env_value "$project_env_path" MAERSK_ENABLED AGENT_ENROLL_DEFAULT_MAERSK_ENABLED || true)" \
      "$(read_env_value "$bootstrap_path" MAERSK_ENABLED AGENT_ENROLL_DEFAULT_MAERSK_ENABLED || true)" \
      "$(read_env_value "$dotenv_path" MAERSK_ENABLED AGENT_ENROLL_DEFAULT_MAERSK_ENABLED || true)" \
      "1")"
    maersk_headless="$(first_non_empty \
      "$(read_env_value "$project_env_path" MAERSK_HEADLESS AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS || true)" \
      "$(read_env_value "$bootstrap_path" MAERSK_HEADLESS AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS || true)" \
      "$(read_env_value "$dotenv_path" MAERSK_HEADLESS AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS || true)" \
      "1")"
    maersk_timeout_ms="$(first_non_empty \
      "$(read_env_value "$project_env_path" MAERSK_TIMEOUT_MS AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS || true)" \
      "$(read_env_value "$bootstrap_path" MAERSK_TIMEOUT_MS AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS || true)" \
      "$(read_env_value "$dotenv_path" MAERSK_TIMEOUT_MS AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS || true)" \
      "120000")"
    maersk_user_data_dir="$(first_non_empty \
      "$(read_env_value "$project_env_path" MAERSK_USER_DATA_DIR AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR || true)" \
      "$(read_env_value "$bootstrap_path" MAERSK_USER_DATA_DIR AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR || true)" \
      "$(read_env_value "$dotenv_path" MAERSK_USER_DATA_DIR AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR || true)" \
      "")"

    {
      printf 'BACKEND_URL=%s\n' "$backend_url"
      printf 'INSTALLER_TOKEN=%s\n' "$installer_token"
      printf 'AGENT_ID=%s\n' "$agent_id"
      printf 'INTERVAL_SEC=%s\n' "$interval_sec"
      printf 'LIMIT=%s\n' "$limit_value"
      printf 'MAERSK_ENABLED=%s\n' "$maersk_enabled"
      printf 'MAERSK_HEADLESS=%s\n' "$maersk_headless"
      printf 'MAERSK_TIMEOUT_MS=%s\n' "$maersk_timeout_ms"
      printf 'MAERSK_USER_DATA_DIR=%s\n' "$maersk_user_data_dir"
      printf 'AGENT_UPDATE_MANIFEST_CHANNEL=%s\n' "$update_manifest_channel"
    } > "$bootstrap_path"

    echo "[agent:run] generated bootstrap.env from .env at $bootstrap_path"
  else
    echo "[agent:run] waiting for config: $dotenv_path or $bootstrap_path"
    echo "[agent:run] missing BACKEND_URL/INSTALLER_TOKEN in $project_env_path"
    while [ ! -f "$dotenv_path" ] && [ ! -f "$bootstrap_path" ]; do
      sleep 2
    done
    echo "[agent:run] config detected, starting agent"
  fi
else
  update_manifest_channel="$(first_non_empty \
    "${AGENT_UPDATE_MANIFEST_CHANNEL:-}" \
    "$(read_env_value "$dotenv_path" AGENT_UPDATE_MANIFEST_CHANNEL || true)" \
    "$(read_env_value "$bootstrap_path" AGENT_UPDATE_MANIFEST_CHANNEL || true)" \
    "$(read_env_value "$project_env_path" AGENT_UPDATE_MANIFEST_CHANNEL || true)" \
    "stable")"
fi

if [ -f "$register_path" ]; then
  node_args=("--import=$register_path" "${node_args[@]}")
fi

DOTENV_PATH="$dotenv_path" \
BOOTSTRAP_DOTENV_PATH="$bootstrap_path" \
AGENT_DATA_DIR="$agent_data_dir" \
AGENT_UPDATE_MANIFEST_CHANNEL="$update_manifest_channel" \
AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS="$disable_automatic_update_checks" \
node "${node_args[@]}"
