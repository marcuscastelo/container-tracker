#!/usr/bin/env bash
set -euo pipefail

if [ "${OSTYPE:-}" = "msys" ] || [ "${OSTYPE:-}" = "cygwin" ] || [ "${OSTYPE:-}" = "win32" ]; then
  echo "[agent:rebuild-restart:linux] Linux only."
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
project_env_path="$repo_root/.env"
pkg_dir="$repo_root/packaging/arch"
agent_data_dir="/var/lib/container-tracker-agent"
service_name="container-tracker-agent.service"
tray_app_dir="/usr/lib/container-tracker-agent/dist/apps/agent/control-ui"
default_backend_url="https://castro-aduaneira.vercel.app/"

find_existing_tray_pids() {
  local user_id="$1"
  local proc_root environ_path pid
  local electron_pattern="/usr/bin/electron .*${tray_app_dir}"
  proc_root="${CT_AGENT_PROC_ROOT:-/proc}"

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    environ_path="$proc_root/$pid/environ"
    [ -r "$environ_path" ] || continue

    if tr '\0' '\n' < "$environ_path" | grep -Fx 'CT_AGENT_UI_MODE=tray' >/dev/null 2>&1; then
      printf '%s\n' "$pid"
    fi
  done < <(pgrep -u "$user_id" -f "$electron_pattern" || true)
}

restart_tray_for_current_session() {
  local tray_command="ct-agent-tray"
  local tray_log_dir tray_log_path user_id existing_tray_pids pid
  user_id="$(id -u)"

  if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    echo "[agent:rebuild-restart:linux] no graphical session detected; tray autostart will apply on next login."
    return 0
  fi

  if ! command -v "$tray_command" >/dev/null 2>&1; then
    echo "[agent:rebuild-restart:linux] $tray_command not available in PATH; skipping tray restart."
    return 0
  fi

  existing_tray_pids="$(find_existing_tray_pids "$user_id")"
  if [ -n "$existing_tray_pids" ]; then
    echo "[agent:rebuild-restart:linux] restarting existing tray process..."
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill "$pid" || true
    done <<< "$existing_tray_pids"
    sleep 1
  fi

  tray_log_dir="${XDG_CACHE_HOME:-$HOME/.cache}/container-tracker-agent"
  tray_log_path="$tray_log_dir/tray.log"
  mkdir -p "$tray_log_dir"
  nohup "$tray_command" >"$tray_log_path" 2>&1 &
  disown || true
  echo "[agent:rebuild-restart:linux] started tray in current session (log: $tray_log_path)"
}

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
        if (index(line, "export " key "=") == 1) {
          print substr(line, length("export " key) + 2)
          exit
        }
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

main() {
  local backend_url installer_token agent_id interval_sec limit_value
  local maersk_enabled maersk_headless maersk_timeout_ms maersk_user_data_dir
  local tmp_bootstrap pkg_file

  if [ ! -f "$project_env_path" ]; then
    echo "[agent:rebuild-restart:linux] missing repo .env at $project_env_path" >&2
    exit 1
  fi

  backend_url="$(first_non_empty \
    "$(read_env_value "$project_env_path" BACKEND_URL AGENT_BACKEND_URL || true)" \
    "${AGENT_BACKEND_URL:-}" \
    "${BACKEND_URL:-}" \
    "$default_backend_url")"
  installer_token="$(first_non_empty \
    "$(read_env_value "$project_env_path" INSTALLER_TOKEN AGENT_INSTALLER_TOKEN || true)" \
    "${AGENT_INSTALLER_TOKEN:-}" \
    "${INSTALLER_TOKEN:-}")"

  if [ -z "$installer_token" ]; then
    echo "[agent:rebuild-restart:linux] INSTALLER_TOKEN is required in $project_env_path" >&2
    exit 1
  fi

  agent_id="$(first_non_empty \
    "$(read_env_value "$project_env_path" AGENT_ID || true)" \
    "${AGENT_ID:-}" \
    "container-tracker-agent")"
  interval_sec="$(first_non_empty \
    "$(read_env_value "$project_env_path" INTERVAL_SEC AGENT_ENROLL_DEFAULT_INTERVAL_SEC || true)" \
    "${AGENT_ENROLL_DEFAULT_INTERVAL_SEC:-}" \
    "60")"
  limit_value="$(first_non_empty \
    "$(read_env_value "$project_env_path" LIMIT AGENT_ENROLL_DEFAULT_LIMIT || true)" \
    "${AGENT_ENROLL_DEFAULT_LIMIT:-}" \
    "10")"
  maersk_enabled="$(first_non_empty \
    "$(read_env_value "$project_env_path" MAERSK_ENABLED AGENT_ENROLL_DEFAULT_MAERSK_ENABLED || true)" \
    "${AGENT_ENROLL_DEFAULT_MAERSK_ENABLED:-}" \
    "1")"
  maersk_headless="$(first_non_empty \
    "$(read_env_value "$project_env_path" MAERSK_HEADLESS AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS || true)" \
    "${AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS:-}" \
    "1")"
  maersk_timeout_ms="$(first_non_empty \
    "$(read_env_value "$project_env_path" MAERSK_TIMEOUT_MS AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS || true)" \
    "${AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS:-}" \
    "120000")"
  maersk_user_data_dir="$(first_non_empty \
    "$(read_env_value "$project_env_path" MAERSK_USER_DATA_DIR AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR || true)" \
    "${AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR:-}" \
    "")"

  echo "[agent:rebuild-restart:linux] building package..."
  cd "$pkg_dir"
  makepkg -f --nodeps

  pkg_file="$(ls -1t container-tracker-agent-*-x86_64.pkg.tar.zst | head -n 1)"
  if [ -z "$pkg_file" ]; then
    echo "[agent:rebuild-restart:linux] package file not found after makepkg" >&2
    exit 1
  fi

  echo "[agent:rebuild-restart:linux] reinstalling package $pkg_file..."
  sudo systemctl stop "$service_name" || true
  sudo pacman -U --noconfirm "$pkg_file"
  sudo systemctl daemon-reload

  echo "[agent:rebuild-restart:linux] stopping service and cleaning runtime state..."
  sudo install -d -m 0750 -o container-tracker-agent -g container-tracker-agent "$agent_data_dir"
  sudo find "$agent_data_dir" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  sudo install -d -m 0750 -o container-tracker-agent -g container-tracker-agent "$agent_data_dir/logs"

  tmp_bootstrap="$(mktemp)"
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
  } > "$tmp_bootstrap"
  sudo install -m 0640 -o container-tracker-agent -g container-tracker-agent \
    "$tmp_bootstrap" "$agent_data_dir/bootstrap.env"
  rm -f "$tmp_bootstrap"

  echo "[agent:rebuild-restart:linux] starting service..."
  sudo systemctl enable --now "$service_name"
  sleep 2
  sudo systemctl status "$service_name" --no-pager
  echo "---"
  sudo journalctl -u "$service_name" -n 120 --no-pager
  restart_tray_for_current_session
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
