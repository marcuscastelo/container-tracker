# AGENTS — Container Tracker (Root, Canonical)

This is the canonical instruction file for this repository.

All assistant-specific files (including `.github/copilot-instructions.md`) should point here.
For tracking-only changes, also read `src/modules/tracking/AGENTS.md`.

Goal: preserve domain correctness, auditability, and architectural boundaries.

---

## 0) Read-First (Mandatory)

Before implementing anything non-trivial, consult:

- Product/domain model: `docs/MASTER_v2.md`
- Types and layers rules: `docs/TYPE_ARCHITECTURE.md`
- BC vs capability boundaries: `docs/BOUNDARIES.md`
- Tracking invariants: `docs/TRACKING_INVARIANTS.md`
- Event series semantics: `docs/TRACKING_EVENT_SERIES.md`
- Alert policy: `docs/ALERT_POLICY.md`
- High-level architecture: `docs/ARCHITECTURE.md`
- Roadmap: `docs/ROADMAP.md`

If any canonical file is missing/renamed, stop and ask for the correct path.

---

## 1) Architecture (Non-Negotiable)

### 1.1 Bounded Contexts (`src/modules/*`)
BCs own semantics and domain rules.

- `process`: shipment/process grouping and read models
- `container`: container identity and association to process
- `tracking`: snapshots, observations, timeline/status/alerts derivation, carrier integration

### 1.2 Capabilities (`src/capabilities/*`)
Capabilities orchestrate across BCs.

- May depend on `modules/*/application`
- Must not import `modules/*/domain`
- Must not define canonical domain semantics
- Modules must never depend on capabilities

---

## 2) Domain Invariants

- Snapshots are immutable (no in-place update)
- Observations are append-only (no delete/rewrite)
- Status is derived, never primary truth
- Raw payload must always be preserved
- Conflicts/uncertainties are exposed, never hidden
- Incomplete data is valid domain input:
  ETA missing must be explicit, timeline gaps are tolerated, UI must explain absence

### Event Series
- `event_time_type` is `ACTUAL | EXPECTED`
- Semantic observations form a series
- One series generates exactly one timeline primary
- If there is ACTUAL: primary is latest ACTUAL
- If no ACTUAL: primary is latest valid EXPECTED
- EXPECTED after ACTUAL is preserved fact, redundant for display
- Multiple ACTUAL in same series is conflict (preserve facts + signal uncertainty)
- `EXPIRED_EXPECTED` is derived state, never persisted as fact mutation

---

## 3) Alerts

- Fact alerts: fact-derived, can be retroactive, mark `retroactive: true` when applicable
- Monitoring alerts: time-dependent (`now`), must not be retroactive
- Never delete facts to clean noise

---

## 4) Type and Layer Rules

- `any` forbidden; use `unknown` + explicit guards
- `readonly` whenever applicable in domain/application contracts
- `as` forbidden (except `as const`)
- Dynamic `await import(...)` is forbidden
- No `Partial<Entity>` input contracts
- Repositories must not return `{ success: boolean }`
- Repositories must not swallow errors
- Repositories must not receive Commands directly
- Distinct shapes must not be mixed:
  Row (infra) != Entity (domain) != DTO (interface) != ViewModel (UI)
- `snake_case` only in persistence and persistence mappers
- Prefer named exports; avoid `export default`

---

## 5) UI Responsibilities

UI may:
- format dates/locales
- apply i18n
- render uncertainty states
- manage interaction state

UI must not:
- derive domain truth (status/timeline/alerts)
- classify/reconcile tracking series
- mutate facts
- import `modules/*/domain` for semantic derivation

---

## 6) SolidJS and i18n Discipline

- Use `createSignal` for state, `createMemo` for derivation
- Use `createEffect` only for side effects
- Keep explicit UI states: `loading | empty | error | ready`
- Do not use hardcoded literal keys in `t()`
- Prefer `const { t, keys } = useTranslation()` and `t(keys.someKey)`
- When adding i18n keys, run: `pnpm i18n:check`

---

## 7) Security and Validation

- Treat all external input as hostile
- Validate boundaries with Zod
- Keep explicit timeouts and rate limits in integrations
- Never render raw unsafe HTML from external payloads

---

## 8) Testing Expectations

For domain-sensitive changes, tests should cover:

- timeline derivation
- series classification
- expected expiration
- conflicting ACTUAL
- retroactive alerts
- UI visibility for empty/error/conflict states

Prefer deterministic fixtures and stable tests.

---

## 9) Anti-Patterns (Forbidden)

- Deleting old EXPECTED observations
- Recomputing domain status in UI
- Persisting status as primary source of truth
- Suppressing conflicting ACTUAL facts
- Inventing carrier behavior not evidenced by payloads/spec
- Hiding uncertainty (ETA unknown, ACTUAL conflicts, parse failures)
- Introducing generic abstractions without clear domain backing
- Using type assertions to force invalid data through
- Importing domain from capability layer

---

## 10) Decision Matrix

If you modify:

- `src/modules/tracking/domain/*` -> re-read `docs/TRACKING_INVARIANTS.md` and `docs/TRACKING_EVENT_SERIES.md`
- alerts logic -> re-read `docs/ALERT_POLICY.md`
- boundaries/dependencies -> re-read `docs/BOUNDARIES.md`
- type/DTO contracts -> re-read `docs/TYPE_ARCHITECTURE.md`
- product/domain wording -> re-read `docs/MASTER_v2.md`

---

## 11) Pre-Commit Checklist

- Preserved snapshot immutability and observation append-only?
- Preserved one-primary-per-series?
- Kept domain logic out of UI?
- Kept module/capability boundaries intact?
- Avoided `any`, unsafe `as`, and `Partial<Entity>` contracts?
- Kept `snake_case` confined to persistence?

If any answer is "not sure", stop and re-check canonical docs.

---

## 12) Core Principle

States are derived from events.
Events are derived from snapshots.
Snapshots are never discarded.
UI never defines domain truth.

---

## 13) Historical Docs

Files under `docs/0204/*` are historical context only.
For current decisions, always prioritize the canonical docs listed in section 0.

---

## 14) Copy/Paste Output Preference

When returning content intended to be copied and pasted (for example PR title/description, changelog blocks, release notes, shell snippets, or templates):

- Prefer wrapping the whole payload with **4 backticks** (```` ... ````) to avoid nesting issues.
- If the output is long/structured, a canvas-like alternative is acceptable, but default is still 4 backticks for plain copy/paste.

---

## 15) Git and Sandbox Execution

Definitions:

- **Sandbox** = restricted execution environment (limited filesystem/process/network, sometimes isolated from host `ssh-agent`).
- Some assistants run with sandboxing; others run directly on host without sandbox.

Rules:

- If sandbox exists, **never run Git commands inside sandbox**.
- Always run Git commands with non-sandbox/external execution so commit signing, credentials, and agent access behave correctly.
- If the assistant has no sandbox feature, treat host execution as compliant and proceed normally.

Why:

- Git operations (especially signed commits) can fail inside sandbox due to missing agent/key access and askpass crashes.
