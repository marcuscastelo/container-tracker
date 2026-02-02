### Purpose
These instructions help AI coding agents become productive in this repository quickly. Focus areas: app architecture, important files, developer workflows, and project-specific conventions.

### Quick start (what to run)
- Node.js >= 22 is required (see `package.json` "engines").
- Install deps and run dev server:
  - npm install
  - npm run dev   # runs `vinxi dev`
- Build for production:
  - npm run build
  - npm start

### High-level architecture
- This is a small SolidJS / SolidStart PoC app scaffolded with Vinxi. UI lives under `src/` (routes and components).
- Data shaping is done by schema files in `schemas/` and the sample-data loader at `src/lib/collections.ts`.
- The app shows a list of shipments derived from JSON samples in `collections/*/*.json` (provider folders: `maersk`, `cmacgm`, `msc`, ...).

Why this structure: the project intentionally separates:
- provider-specific raw payloads (collections/*.json)
- a normalized schema (`schemas/containerStatus.schema.ts`) using zod
- a simplified UI schema (`schemas/shipment.schema.ts`) used by components

This makes the code tolerant to multiple vendor payload shapes and suitable for PoC iterations.

### Key files and what they show
- `src/lib/collections.ts` — Core mapping logic & sample loader. Important behaviors:
  - Uses `import.meta.globEager` in dev (Vite) when available; falls back to reading files from disk for SSR (Node) — follow its try/catch flow when changing file-loading behavior.
  - Contains provider-specific fallbacks (MSC, CMA-CGM) and extensive date parsing logic (see parseDateLike). If you add a new provider, add mapping fallbacks here.
- `schemas/containerStatus.schema.ts` — comprehensive zod schema for normalized shipments/containers/events.
- `schemas/shipment.schema.ts` — minimal UI schema the routes/components expect.
- `src/routes/index.tsx` — Example UI that consumes `getPoCShipments()` and renders the table.
- `app.config.ts` — Vinxi/Vite config (Tailwind plugin). Editing dev-server behavior typically happens here.

### Project-specific conventions / patterns
- ESM-only TypeScript (package.json `type: "module"`) — use import syntax and async dynamic imports.
- Aliases: code uses `~` style imports (e.g. `~/lib/collections`) — respect Vite / Vinxi resolver when moving files.
- Logging: code relies on `console.debug` / `console.warn` / `console.error` in mapping logic. When changing behavior, keep useful debug messages.
- Zod validation: `collections.ts` attempts normalized parse first, then falls back to mapping raw object to UI schema. Do not assume all samples match `containerStatus` schema.

### Adding sample data
- Add JSON under `collections/<provider>/*.json`. The loader will pick it up in dev (globEager) and in server fallback.
- Try to include representative raw fields (e.g., `Data.BillOfLadings` for MSC, `PODDate`/`POL` for CMA-CGM) to exercise mapping code.

### Integration & external deps
- Runtime: `vinxi` + `solid-start` + `solid-js` + `zod` + Tailwind. No backend services in this repo — mapping code simulates provider inputs.

### Common edits & pitfalls for agents
- If changing the loader in `src/lib/collections.ts`, test both dev (Vite) and SSR paths — the file has a hard-coded fallback that uses Node `fs` and `process.cwd()`.
- Keep schema changes coordinated: if you extend `ContainerSchema` or `ShipmentSchema`, update both the zod schema file and any code that accesses the new fields (mapping, UI rendering).
- Date parsing is liberal: preserve the helper heuristics unless you have provider guarantees; otherwise add provider-specific parsing upstream.

### Examples to reference
- To find how UI expects data: `src/routes/index.tsx` consumes `getPoCShipments()` which returns items matching `schemas/shipment.schema.ts`.
- Loader behavior: `src/lib/collections.ts` — search for `globEager` and the `fs` fallback to understand environment-specific behavior.

If anything in these notes is unclear or you want more examples (unit tests, new data mapping), tell me which area to expand and I will iterate.
