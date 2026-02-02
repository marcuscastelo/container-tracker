These instructions help AI coding agents and contributors become productive in this repository quickly. They summarise architecture, important files, conventions, and the specific mapping heuristics used by the PoC loader.

### Quick start (what to run)
- Node.js >= 22 is required (see `package.json` "engines").
- Install dependencies and run dev server:
  - npm install
  - npm run dev   # runs `vinxi dev`
- Build for production:
  ## Purpose
  Concise guidance for AI coding agents and contributors to become productive quickly in this SolidJS / SolidStart PoC.

  ## Quick start (commands)
  Node.js >= 22 (see `package.json`). Typical local flow:
  ```bash
  npm install
  npm run dev    # runs `vinxi dev` (development, uses Vite)
  npm run build
  npm start      # production server
  ```

  ## High-level architecture (why it exists)
  - UI: `src/` (routes + components) — minimal SolidStart app showing a shipments list.
  - Data loader: `src/lib/collections.ts` — loads sample JSON payloads from `collections/`, validates with Zod, and maps to a small UI schema.
  - Schemas: `schemas/containerStatus.schema.ts` (comprehensive) and `schemas/shipment.schema.ts` (UI shape).
  - Samples: `collections/<provider>/*.json` (provider folders: `maersk`, `cmacgm`, `msc`, ...). The design is to keep provider raw payloads for robust fallbacks.

  ## Key patterns & conventions (actionable)
  - Always map from the original raw object, not the Zod-parsed value, when you need provider-specific keys. See `src/lib/collections.ts` — it validates but uses the raw payload for mapping.
  - Dev vs SSR loading:
    - Dev/client: uses `import.meta.globEager('../../collections/**/*.json')` (bundles samples).
    - SSR/node: falls back to reading `collections/` from disk with `fs` (useful for server-side rendering/testing).
  - Container number heuristics: checks normalized fields first, then common keys (`container_number`, `ContainerNumber`), then filename fallback.
  - Carrier inference: prefer normalized/operator fields; otherwise derive from the folder name (`collections/<provider>/...`).
  - Origin/destination & ETA: layered fallbacks with provider-specific logic (see `src/lib/collections.ts` for exact order). ETA parsing accepts `/Date(...)`, ISO, timestamps, and `DD/MM/YYYY` formats.

  ## Important files to inspect when changing behaviour
  - `src/lib/collections.ts` — the core loader + mapper. If you edit it, test both dev (Vite) and SSR behaviour.
  - `schemas/containerStatus.schema.ts` — full Zod schema used for validation and normalization.
  - `schemas/shipment.schema.ts` — the minimal UI schema components expect.
  - `src/routes/index.tsx` — example consumer of `getPoCShipments()`.
  - `collections/*/*.json` — add samples here to exercise provider-specific mapping.

  ## Debugging tips
  - Logs: loader emits `console.debug/warn/error` showing whether globEager or fs path was used and which fallbacks were selected.
  - To reproduce SSR behaviour locally, run the built server (`npm run build && npm start`) and check server logs (not the browser console).

  ## Adding a new provider (practical steps)
  1. Add JSON to `collections/<new-provider>/example.json`.
  2. Add provider-specific mapping heuristics in `src/lib/collections.ts` (follow existing patterns: container extraction, carrier inference, origin/ETA fallbacks).
  3. Run dev and build+start to verify both client and SSR loading paths.

  ## Minimal examples from this repo
  - Sample path: `collections/msc/CXDU2058677.json` — used to exercise MSC-specific fallbacks like `Data.BillOfLadings`.
  - See `src/routes/index.tsx` for how the UI consumes the simplified shipment objects returned by the loader.

  ## Keep in mind
  - The loader intentionally preserves unknown provider fields so the UI (or future mappings) can fallback — do not strip unknowns prematurely.
  - There are no unit tests in the repo; validate changes by adding sample JSON and verifying UI + server logs.