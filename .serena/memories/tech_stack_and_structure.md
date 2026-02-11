# Tech Stack & Structure: Container Tracker

## Tech Stack
- Node.js (>=22)
- TypeScript (strict, no `any`, no `as`)
- SolidJS / SolidStart (UI)
- Vinxi/Vite (bundler/dev)
- Zod (validation)
- BiomeJS (formatter/linter)
- ESLint (SolidJS-specific rules)
- Vitest (testing)
- TailwindCSS (UI styling)
- Supabase (database)

## Directory Structure
- `src/`
  - `modules/` (domain, application, infrastructure, UI per context)
  - `routes/` (pages, API endpoints)
  - `shared/` (utilities, localization, config)
  - `locales/` (i18n JSON files)
- `collections/` (raw samples per provider)
- `schemas/` (Zod schemas for normalized data)
- `docs/` (master, roadmap, process fields)
- `scripts/` (i18n, type assertion removal, etc.)
- `test/` (fixtures)

## Entry Points
- Dev: `pnpm run dev` (Vinxi dev server)
- Build: `pnpm run build` (Vinxi build)
- Start: `pnpm start` (Vinxi start)

## Key Files
- `src/lib/collections.ts` (mapping, parsing heuristics)
- `schemas/containerStatus.schema.ts` (event/container schema)
- `schemas/shipment.schema.ts` (UI consumption schema)
- `src/routes/index.tsx` (example consumption/render)

---
This memory details the tech stack, directory structure, and entry points for development. See `README.md` and `docs/master-consolidated-0209.md` for more.