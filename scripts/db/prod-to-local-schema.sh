#!/usr/bin/env bash
set -euo pipefail

pnpm db:stage:ensure
pnpm db:prod:pull:schema

echo "Shared staging was kept intact. Review the pulled schema and rebuild staging explicitly if needed:"
echo "pnpm db:stage:rebuild"
