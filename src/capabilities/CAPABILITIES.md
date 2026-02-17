# Capabilities Layer

Capabilities in `src/capabilities/*` are **cross-cutting feature slices**.

They:

- Orchestrate multiple Bounded Contexts
- Compose read models
- Provide feature-level behavior

They do NOT:

- Own domain semantics
- Define canonical states

Examples:

search/
  Global search across process, container, tracking

Future:

dashboard/
  KPI aggregation

See also:

- `docs/MODULE_CAPABILITIES_MAP.md` — operational map of internal capabilities inside each BC.