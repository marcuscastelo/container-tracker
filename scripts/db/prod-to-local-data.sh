#!/usr/bin/env bash
set -euo pipefail

pnpm supabase:start
pnpm db:prod:dump:data
pnpm db:dev:restore:data