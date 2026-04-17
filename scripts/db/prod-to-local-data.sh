#!/usr/bin/env bash
set -euo pipefail

pnpm db:stage:ensure
pnpm db:prod:dump:data
pnpm db:local:restore:data
