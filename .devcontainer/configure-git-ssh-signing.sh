#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log_info() {
  echo "[git-signing] $1"
}

log_warn() {
  echo "[git-signing] warning: $1"
}

cleanup_stale_local_config() {
  current_signing_key="$(git config --local --get user.signingkey || true)"
  case "$current_signing_key" in
    /workspaces/* | /home/node/*)
      git config --local --unset-all user.signingkey || true
      log_warn "Removed stale container path from user.signingkey: $current_signing_key"
      ;;
  esac

  current_allowed_signers="$(git config --local --get gpg.ssh.allowedSignersFile || true)"
  case "$current_allowed_signers" in
    /workspaces/* | /home/node/*)
      git config --local --unset-all gpg.ssh.allowedSignersFile || true
      log_warn "Removed stale container path from gpg.ssh.allowedSignersFile: $current_allowed_signers"
      ;;
  esac
}

if [ ! -d ".git" ]; then
  log_warn "No .git directory found; skipping SSH signing setup."
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  log_warn "'git' command not found; skipping SSH signing setup."
  exit 0
fi

if ! command -v ssh-add >/dev/null 2>&1; then
  log_warn "'ssh-add' command not found; skipping SSH signing setup."
  exit 0
fi

cleanup_stale_local_config

if [ -z "${SSH_AUTH_SOCK:-}" ] || [ ! -S "$SSH_AUTH_SOCK" ]; then
  log_warn "SSH agent socket is unavailable (SSH_AUTH_SOCK not set or invalid)."
  exit 0
fi

agent_keys="$(ssh-add -L 2>/dev/null || true)"
if [ -z "$agent_keys" ] || printf '%s\n' "$agent_keys" | grep -q "The agent has no identities"; then
  log_warn "SSH agent is reachable but has no identities loaded."
  exit 0
fi

signing_key="$(printf '%s\n' "$agent_keys" | awk '/signing key for commits/{print; found=1; exit} END{if(!found) exit 1}' || true)"
if [ -z "$signing_key" ]; then
  signing_key="$(printf '%s\n' "$agent_keys" | head -n 1)"
fi

if [ -z "$signing_key" ]; then
  log_warn "Could not resolve a public key from ssh-agent output."
  exit 0
fi

case "$signing_key" in
  key::*)
    signing_key_value="$signing_key"
    ;;
  *)
    signing_key_value="key::$signing_key"
    ;;
esac

git config --local gpg.format ssh
git config --local commit.gpgsign true
git config --local gpg.ssh.defaultKeyCommand "ssh-add -L"
git config --local user.signingkey "$signing_key_value"

author_email="$(git config --get user.email || true)"
if [ -n "$author_email" ]; then
  allowed_signers_file=".git/devcontainer-allowed-signers"
  printf '%s %s\n' "$author_email" "$signing_key" > "$allowed_signers_file"
  git config --local gpg.ssh.allowedSignersFile "$allowed_signers_file"
  log_info "Configured repository-local SSH signing key for '$author_email'."
else
  log_warn "Configured signing key, but 'user.email' is unset; allowed signers file was not written."
fi
