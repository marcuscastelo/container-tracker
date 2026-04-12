#!/usr/bin/env bash
set -euo pipefail

npx supabase db pull --linked --schema public

echo "Remote schema pulled into supabase/migrations"
echo "Review the generated migration before committing."