#!/usr/bin/env bash
set -euo pipefail

mkdir -p .tmp

npx supabase db dump \
  --linked \
  -f .tmp/prod-data.sql \
  --use-copy \
  --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

echo "Dump created at .tmp/prod-data.sql"