### Purpose
These instructions help AI coding agents and contributors become productive in this repository quickly. They summarise architecture, important files, conventions, and the specific mapping heuristics used by the PoC loader.

### Quick start (what to run)
- Node.js >= 22 is required (see `package.json` "engines").
- Install dependencies and run dev server:
  - npm install
  - npm run dev   # runs `vinxi dev`
- Build for production:
  - npm run build
  - npm start

### High-level architecture
- Small SolidJS / SolidStart PoC scaffolded with Vinxi. UI lives under `src/` (routes and components).
- Data shaping lives in `schemas/` and the sample-data loader `src/lib/collections.ts`.
- The app renders a shipments list derived from JSON samples in `collections/*/*.json` (provider folders: `maersk`, `cmacgm`, `msc`, ...).

Design choices
- Provider-specific raw payloads are stored under `collections/` to keep mapping logic isolated from UI code.
- A comprehensive zod schema (`schemas/containerStatus.schema.ts`) validates/normalizes provider payloads.
- A small UI schema (`schemas/shipment.schema.ts`) describes the simplified shape the components expect.

### Key files
- `src/lib/collections.ts` — loader + mapping logic. Important responsibilities:
  - Load sample JSONs (Vite `import.meta.globEager` in dev) or read from disk during SSR fallback.
  - Validate with the comprehensive Zod schema when possible, but map from the original raw object so provider-specific fields are preserved for fallbacks.
  - Contain provider-specific heuristics for MSC, CMA-CGM, MAERSK, etc. (origin/destination, ETA, container number, carrier inference).
- `schemas/containerStatus.schema.ts` — large normalized zod schema for shipments/containers/events.
- `schemas/shipment.schema.ts` — minimal UI zod schema used by components.
- `src/routes/index.tsx` — example UI consuming `getPoCShipments()`.

### Loader behaviour & heuristics (important)
- Loading:
  - Client/dev: uses `import.meta.globEager('../../collections/**/*.json')` to bundle samples.
  - SSR/node: falls back to reading files from `collections/` using `fs` and `process.cwd()`.
  - Logging is present to show which path (globEager vs fs) was used.
- Mapping strategy (high level):
  1. Try validating with `ShipmentSchema` (comprehensive), but always map from the original raw object so provider-specific keys (like `Reciept`, `LastDischargePort`, `Data.*`) remain available.
  2. Extract container number: prefer normalized fields, then common names (container_number/container_no/container_num/ContainerNumber), then filename fallback (the sample's JSON filename).
  3. Infer carrier (armador): prefer normalized/operator fields, otherwise infer from the folder name (`collections/<provider>/...`).
  4. Resolve origin/destination using multiple fallbacks in order:
     - normalized `origin.city` / `destination.city`
     - container `locations` (first/last)
     - MSC: `Data.BillOfLadings[0].GeneralTrackingInfo` (PortOfLoad / PortOfDischarge, ShippedFrom / ShippedTo)
     - CMA-CGM: top-level `Reciept`, `LastDischargePort`, `POL`, `POD` or `ContextInfo` fields
     - route string fallback (split on arrows/dashes)
  5. Derive ETA with provider-aware fallbacks and flexible parsing (handles `/Date(...)` strings, ISO, numeric timestamps, and `DD/MM/YYYY`):
     - container-level `eta_final_delivery`
     - common fields (EstimatedTimeOfArrival / last_update_time / eta_display)
     - CMA-CGM `PODDate` / `ContextInfo.ValueLeft`
     - MSC `Data.BillOfLadings[0].GeneralTrackingInfo.FinalPodEtaDate` or `ContainersInfo[0].PodEtaDate`
     - events: prefer MSC container-level event with highest `Order` when present (most recent logical move), otherwise choose the most recent event date across container-level and location-level events.

### Logging & debugging
- The loader includes `console.debug`, `console.warn`, and `console.error` at key points:
  - Which loading strategy was used (globEager vs fs)
  - Which files were loaded
  - Which fallbacks were used to infer carrier/container/origin/destination/ETA
- Use the browser console (client mode) or terminal (SSR/fs fallback) to inspect logs during development.

### Adding sample data
- Place JSON under `collections/<provider>/*.json` (e.g. `collections/msc/CXDU2058677.json`).
- To exercise mapping heuristics, include provider-specific fields: MSC -> `Data.BillOfLadings`, CMA -> `PODDate`/`POL`/`Reciept`, Maersk -> `containers[].locations[]` events, etc.

### Common edits & pitfalls
- If you edit `src/lib/collections.ts`, test both dev (Vite) and SSR paths — the file purposely contains both `import.meta.globEager` and a Node fs fallback.
- Don't pass Zod-parsed objects to the mapper if you need provider-specific keys — parse for validation, but map from the raw object to keep unknown fields.
- Date parsing is permissive: preserve heuristics; add provider-specific parsing only when you have firm guarantees.

### Examples
- UI expects the simplified shipments returned by `getPoCShipments()` (see `src/routes/index.tsx`).
- To add a new provider, add JSON samples and extend `mapNormalizedToUI` with provider-specific fallbacks.

