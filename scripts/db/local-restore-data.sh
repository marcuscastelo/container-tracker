#!/usr/bin/env bash
set -euo pipefail

LOCAL_DB_URL="$(
  npx supabase status 2>/dev/null \
    | grep -o 'postgresql://[^[:space:]|]*' \
    | head -n 1 \
    || true
)"

if [ -z "$LOCAL_DB_URL" ]; then
  echo "Could not detect local DB URL from 'npx supabase status'."
  echo "Make sure Supabase local is running:"
  echo "  npx supabase start"
  exit 1
fi

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

echo "Local restore finished."