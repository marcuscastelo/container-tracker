# Agent Instructions — Container Tracker (Root)

These instructions apply to the entire repository.
If you are editing code via terminal / multi-folder refactors, treat this file as the primary guardrail.

Goal: preserve **domain correctness**, **auditability**, and **architectural boundaries**.

---

## 0) Read-first (mandatory)

Before implementing anything non-trivial, consult these canonical docs:

- Product + conceptual domain: `docs/MASTER_v2.md`
- Types & layers rules: `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md`
- BC vs capability boundaries: `docs/BOUNDARIES.md`
- Tracking invariants: `docs/TRACKING_INVARIANTS.md`
- Event series semantics: `docs/TRACKING_EVENT_SERIES.md`
- Alert semantics: `docs/ALERT_POLICY.md`
- High-level architecture: `docs/ARCHITECTURE.md`
- Roadmap: `docs/ROADMAP.md`

If any file is missing or renamed, stop and ask for the correct path.

---

## 1) Repository architecture (non-negotiable)

### 1.1 Bounded Contexts live in `src/modules/*`
They own semantics and can define domain rules.

- `src/modules/process`: shipments/process grouping + process read models
- `src/modules/container`: container identity + lifecycle + association to process
- `src/modules/tracking`: snapshots/observations + derive timeline/status/alerts + carrier integration

### 1.2 Capabilities live in `src/capabilities/*`
They orchestrate across BCs and compose read models.

Rules:
- capabilities may depend on `modules/*/application`
- capabilities MUST NOT import `modules/*/domain`
- modules MUST NEVER depend on capabilities

---

## 2) Tracking invariants (global understanding)

- Snapshots are immutable (never update in place)
- Observations are append-only (never delete or rewrite)
- Status is derived (never treated as primary truth)
- Raw payload must be preserved
- Conflicts are exposed, not hidden

---

## 3) Event series (critical nuance)

- Events have `event_time_type: ACTUAL | EXPECTED`
- Observations form a **Series** (semantic grouping)
- Timeline shows **one primary per series** (safe-first)
- EXPECTED after ACTUAL is preserved but treated as redundant for display
- Multiple ACTUAL in a series is a conflict → preserve facts + signal uncertainty

---

## 4) Alert policy (fact vs monitoring)

- Fact alerts: derived from facts, may be retroactive, must mark `retroactive: true` when applicable
- Monitoring alerts: depend on "now", must NOT be generated retroactively

Never delete facts to “clean noise”.

---

## 5) Types & layer rules (enforcement)

Canonical reference: `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md`

Key rules:
- `any` forbidden; prefer `unknown` + guards
- `as` forbidden (except `as const`)
- Do not mix shapes: Row (infra) ≠ Entity/Aggregate (domain) ≠ DTO (interface) ≠ ViewModel (UI)
- snake_case only in persistence layer and mappers
- repositories must not return `{ success: boolean }`
- `Partial<Entity>` inputs are forbidden; use explicit input types

---

## 6) UI discipline

UI responsibilities:
- i18n
- locale formatting
- rendering decisions
- interaction state (signals/memos)

UI must NOT:
- derive domain truth (status/timeline/alerts)
- import domain entities to compute semantics
- hide uncertainty

---

## 7) Decision matrix (what to re-read)

If you modify:

- `src/modules/tracking/domain/*` → re-read `docs/TRACKING_INVARIANTS.md` + `docs/TRACKING_EVENT_SERIES.md`
- alerts logic → re-read `docs/ALERT_POLICY.md`
- folder structure / dependencies → re-read `docs/BOUNDARIES.md`
- types / DTO boundaries → re-read `docs/arquitetura_de_tipos...0211.md`
- product/domain wording → re-read `docs/MASTER_v2.md`

---

## 8) Checklist before committing

- Did you preserve snapshot immutability and observation append-only?
- Did you keep one-primary-per-series logic?
- Did you avoid moving domain logic into UI?
- Did you avoid importing domain from capabilities?
- Did you avoid `any` / `as` and `Partial<Entity>`?
- Did you keep snake_case confined to persistence?

If any answer is “not sure”, stop and consult the docs.
