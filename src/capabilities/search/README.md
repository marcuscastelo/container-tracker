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
3. **Grouped results**: Results are categorised by type
   (process, container, importer, exporter, carrier).
4. **Single component**: Both visible dashboard bar and Ctrl+K overlay
   share the same `SearchOverlay` component.
5. **Limit 20**: Results capped at 20 items server-side.
