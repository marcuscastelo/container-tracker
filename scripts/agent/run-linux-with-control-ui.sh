#!/usr/bin/env bash
set -euo pipefail

if [ "${OSTYPE:-}" = "msys" ] || [ "${OSTYPE:-}" = "cygwin" ] || [ "${OSTYPE:-}" = "win32" ]; then
  echo "[agent:run] This command is Linux/macOS only."
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
runtime_launcher_path="$script_dir/run-linux.sh"

agent_data_dir="${AGENT_DATA_DIR:-$repo_root/.agent-runtime}"
dotenv_path="${DOTENV_PATH:-$agent_data_dir/config.env}"
bootstrap_path="${BOOTSTRAP_DOTENV_PATH:-$agent_data_dir/bootstrap.env}"
control_ui_user_data_dir="${CT_AGENT_UI_USER_DATA_DIR:-$agent_data_dir/control-ui-user-data}"
disable_automatic_update_checks="${AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS:-}"

runtime_pid=""
ui_pid=""

is_process_running() {
  local pid="$1"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

stop_process_if_running() {
  local pid="$1"
  if is_process_running "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
  fi
}

launch_runtime() {
  AGENT_DATA_DIR="$agent_data_dir" \
    DOTENV_PATH="$dotenv_path" \
    BOOTSTRAP_DOTENV_PATH="$bootstrap_path" \
    AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS="$disable_automatic_update_checks" \
    bash "$runtime_launcher_path" &
  runtime_pid="$!"
}

launch_control_ui_best_effort() {
  AGENT_DATA_DIR="$agent_data_dir" \
    DOTENV_PATH="$dotenv_path" \
    BOOTSTRAP_DOTENV_PATH="$bootstrap_path" \
    CT_AGENT_UI_INSTALLED=0 \
    CT_AGENT_UI_MODE=window \
    CT_AGENT_UI_DISABLE_SINGLE_INSTANCE_LOCK=1 \
    CT_AGENT_UI_USER_DATA_DIR="$control_ui_user_data_dir" \
    pnpm --filter @container-tracker/agent run control-ui:start &
  ui_pid="$!"
}

report_control_ui_exit() {
  local ui_exit_code="$1"

  if [ "$ui_exit_code" -eq 0 ]; then
    echo "[agent:run] control UI closed; runtime continues."
    return 0
  fi

  if [ "$ui_exit_code" -eq 130 ] || [ "$ui_exit_code" -eq 143 ]; then
    return 0
  fi

  echo "[agent:run] warning: control UI exited with code $ui_exit_code; runtime continues." >&2
}

forward_shutdown_signal() {
  local signal_name="$1"
  echo "[agent:run] received $signal_name, stopping runtime and control UI..."
  stop_process_if_running "$runtime_pid"
  stop_process_if_running "$ui_pid"
}

cleanup() {
  stop_process_if_running "$ui_pid"
}

trap 'forward_shutdown_signal INT' INT
trap 'forward_shutdown_signal TERM' TERM
trap cleanup EXIT

launch_runtime
launch_control_ui_best_effort

ui_exit_reported=0
while is_process_running "$runtime_pid"; do
  if [ "$ui_exit_reported" -eq 0 ] && [ -n "$ui_pid" ] && ! is_process_running "$ui_pid"; then
    if wait "$ui_pid"; then
      ui_exit_code=0
    else
      ui_exit_code="$?"
    fi
    report_control_ui_exit "$ui_exit_code"
    ui_exit_reported=1
    ui_pid=""
  fi

  sleep 0.2
done

runtime_exit_code=0
if wait "$runtime_pid"; then
  runtime_exit_code=0
else
  runtime_exit_code="$?"
fi

if [ "$ui_exit_reported" -eq 0 ] && [ -n "$ui_pid" ] && ! is_process_running "$ui_pid"; then
  if wait "$ui_pid"; then
    ui_exit_code=0
  else
    ui_exit_code="$?"
  fi
  report_control_ui_exit "$ui_exit_code"
  ui_exit_reported=1
  ui_pid=""
fi

if [ "$ui_exit_reported" -eq 0 ] && [ -n "$ui_pid" ]; then
  stop_process_if_running "$ui_pid"
  wait "$ui_pid" 2>/dev/null || true
fi

exit "$runtime_exit_code"
