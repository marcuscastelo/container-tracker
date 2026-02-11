# Style & Design Patterns: Container Tracker

## Domain-Driven Design (DDD)
- Explicit separation: Domain, Application, Infrastructure, UI
- Domain: pure derivation, canonical types, no infra knowledge
- Application: orchestrates pipelines, coordinates adapters
- Infrastructure: fetchers, connectors, raw payload adaptation
- UI: presents projections/history, never calculates domain rules

## Operational UI
- Dense, functional tables
- Status and ETA always visible
- Hover shows last event
- Alerts are events, not magic flags
- Severity is clear (icon + text)

## Testing
- Domain rules: derivation, incomplete/inconsistent cases
- UI: empty/error states, broken data

## Anti-Patterns (to avoid)
- Generic abstractions without domain
- `any` for quick fixes
- UI hiding uncertainty
- Business logic in components
- Magic, non-traceable states

---
See `.github/copilot-instructions.md` and `docs/master-consolidated-0209.md` for full patterns and anti-patterns.