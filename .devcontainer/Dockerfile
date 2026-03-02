FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

ARG CHROMIUM_VERSION

USER root

RUN test -n "$CHROMIUM_VERSION" \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium="${CHROMIUM_VERSION}" \
    jq \
    python3 \
    python3-pip \
  && apt-mark hold chromium \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && npm install -g @openai/codex@0.106.0

COPY .devcontainer/git-guard.sh /usr/local/share/git-guard/git-guard.sh
COPY .devcontainer/pre-push-block.sh /usr/local/share/git-guard/pre-push-block.sh

RUN chmod +x /usr/local/share/git-guard/git-guard.sh \
  && chmod +x /usr/local/share/git-guard/pre-push-block.sh \
  && ln -sf /usr/local/share/git-guard/git-guard.sh /usr/local/bin/git

USER node
