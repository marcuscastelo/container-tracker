#!/usr/bin/env bash
set -euo pipefail

pnpm db:stage:ensure >/dev/null

STAGE_DB_PORT="$(
  node -e "const { execFileSync } = require('node:child_process'); const out = execFileSync(process.execPath, ['./scripts/db/worktree-db.mjs', 'stage-status'], { cwd: process.cwd(), encoding: 'utf8' }); const status = JSON.parse(out); process.stdout.write(String(status.ports.db));"
)"
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:${STAGE_DB_PORT}/postgres"

if [ ! -f .tmp/prod-data.sql ]; then
  echo "Missing .tmp/prod-data.sql"
  echo "Run: pnpm db:prod:dump:data"
  exit 1
fi

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file .tmp/prod-data.sql \
  --dbname "$LOCAL_DB_URL"

pnpm db:stage:refresh-local-snapshot >/dev/null

echo "Shared staging restore finished and local snapshot refreshed."
