# LLM Guardrails — Container Tracker

## 1. Before Writing Code Ask

1. Is this domain logic?
2. Is this application orchestration?
3. Is this infrastructure IO?
4. Is this UI rendering/interaction?

If the answer is unclear, stop and classify the change before coding.

---

## 2. Layer Responsibilities

**Domain**

- Canonical truth and invariants
- Event semantics (ACTUAL/EXPECTED), timeline, status, alerts

**Application**

- Use cases and orchestration
- Read models/projections owned by the BC

**Infrastructure**

- Persistence and external IO
- Carrier adapters, API clients, DB mappers

**UI**

- Rendering and interaction state
- Formatting/i18n
- No domain truth derivation

---

## 3. Naming Enforcement

- Never call a file `ViewModel` if it contains behavior.
- `*.vm.ts` means renderable shape only.
- Sorting/filtering/grouping logic belongs in `*.service.ts` or `*.utils.ts`.
- DTO names/snake_case are HTTP-boundary concerns, not internal contracts.

---

## 4. Forbidden LLM Moves

LLMs must NOT:

- derive status/timeline/alerts in UI
- classify tracking series outside tracking domain/application ownership
- move domain rules into capabilities
- use DTOs as internal application contracts
- simplify ACTUAL/EXPECTED timeline semantics
- hide conflicts, ambiguity, or uncertainty states
- create shared kernel implicitly without explicit policy/ownership

---

## 5. Safety Checklist

Before finishing a change:

1. Domain invariants unchanged
2. Tracking series safe-first semantics preserved
3. Conflicts remain visible
4. Boundary rules respected
5. Type pipeline preserved (`Row -> Entity -> Result -> DTO -> VM`)
