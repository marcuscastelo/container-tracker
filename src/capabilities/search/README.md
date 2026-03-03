# Search Module

Global operational search for the Container Tracker platform.

## Architecture

- **Application**: Use case, projections, repository port
- **Infrastructure**: Supabase-backed search repository
- **Interface/HTTP**: Zod schemas, HTTP mappers, controller
- **UI**: SearchOverlay (Ctrl+K / visible bar)

## Design Decisions

1. **Read-model approach**: Search queries Supabase directly via a
   dedicated repository port — no domain entities exposed to UI.
2. **No fuzzy search (MVP)**: Ranking is deterministic:
   exact → prefix → contains.
3. **Consolidated process rows**: Results are rendered as one row per process,
   showing operational fields (`reference`, `importer`, `containers`, `carrier`, `vessel`, `BL`, `status`, `ETA`).
4. **Single component**: Both visible dashboard bar and Ctrl+K overlay
   share the same `SearchOverlay` component.
5. **Limit 30**: Results capped at 30 items after capability consolidation.
