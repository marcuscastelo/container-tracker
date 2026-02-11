# Suggested Commands: Container Tracker

## Install & Setup
- `pnpm install` — install dependencies
- `pnpm exec playwright install` — install Playwright (for scraping/testing)

## Development
- `pnpm run dev` — start dev server (Vinxi)
- `pnpm run build` — build for production
- `pnpm start` — start production server

## Testing
- `pnpm run test` — run tests (Vitest)
- `pnpm run check` — run lint, type-check, and tests
- `pnpm run flint` — run formatter and linter

## Linting & Formatting
- `pnpm run lint` — Biome + ESLint
- `pnpm run fix` — Biome format + check

## i18n
- `pnpm run i18n:check` — check for missing/inconsistent i18n keys
- `pnpm run i18n:enforce` — enforce no hardcoded strings

## Utilities
- `pnpm run supabase:gen-types` — regenerate Supabase types
- `pnpm run knip` — check unused files/exports

## Test Plan
- See `TEST_PLAN.md` for API refresh route tests

## Linux Utilities
- `ls`, `cd`, `grep`, `find`, `cat`, `jq` — standard file and JSON inspection

---
This memory lists the main commands for development, testing, linting, formatting, and i18n enforcement. See `package.json` scripts and `README.md` for more.