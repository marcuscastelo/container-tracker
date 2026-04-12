#!/usr/bin/env bash
set -euo pipefail

pnpm supabase:start
pnpm db:prod:pull:schema

echo "Now rebuild local from migrations if desired:"
echo "npx supabase db reset"