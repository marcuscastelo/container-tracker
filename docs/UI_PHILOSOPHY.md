# UI Philosophy — Container Tracker

## 1) Purpose

This document defines canonical UI direction for Container Tracker.

It standardizes how shipment/process and dashboard surfaces should communicate operational truth without redefining domain semantics.

Scope:

- visual hierarchy and operator reading flow
- canonical shipment view layout
- timeline rendering philosophy
- UI guardrails for contributors, LLMs, and design/codegen tools

This document does not redefine domain semantics.
Canonical domain truth ownership remains in tracking and related architecture docs.

---

## 2) Core Principles

### Operator-first

UI is optimized for day-to-day operational decisions, not for decorative minimalism.

### Timeline-first

In shipment view, chronology is primary.
timeline is central operational artifact.

### Dense operational UI

standard is high information density with clear hierarchy.
interface should be visually disciplined, not visually sparse.

### Exception-oriented scanning

Operators must quickly identify delays, conflicts, stale predictions, and missing data.

### Supporting metadata in sidebar

Shipment information and current status are supporting context.
They belong in sidebar panels and must not interrupt chronological flow.

### Grouped operational timeline blocks

Timeline rendering must preserve meaningful operational grouping.
Do not flatten shipment timeline into generic event list when grouping exists in read model.

---

## 3) What UI May Do

UI may:

- map DTO/read-model data into ViewModels for presentation
- format dates, labels, and locale-specific display
- apply i18n and accessibility semantics
- sort/filter/presentational grouping for UI ergonomics
- render uncertainty, conflicts, and missing-data states explicitly
- provide interaction affordances (selection, expansion, tabs, sticky controls)

UI may polish presentation of timeline blocks and cards, but must preserve underlying operational meaning provided by backend read models.

---

## 4) What UI Must Never Do

UI must never:

- derive timeline semantics
- derive status semantics
- derive alert semantics
- reclassify ACTUAL vs EXPECTED
- perform event-series grouping/classification domain truth
- detect transshipment semantics by reinterpreting raw events
- reinterpret `TERMINAL_MOVE` lifecycle progression (for example ARRIVAL/LOAD)
- suppress or rewrite conflicting facts to make screens look cleaner
- collapse append-only historical visibility into lossy narrative

If UI requirement needs semantic interpretation, add/adjust backend read model in owning bounded context.

---

## 5) Shipment Screen Canonical Layout

Canonical shipment/process detail layout:

- Main content column:
  - container selector
  - timeline (primary operational artifact)
- Sidebar:
  - shipment information
  - current status
  - supporting operational metadata

On desktop layout is two-column.
On mobile sidebar may stack below timeline, but timeline must remain first in reading order.

Rules:

- chronology remains primary
- supporting cards must not be inserted between timeline sections
- timeline and sidebar should remain simultaneously scannable on desktop
- mobile may stack sections, but timeline remains first in reading order

### Timeline Content Expectations

shipment timeline may include grouped operational blocks, such:

- pre-carriage
- vessel/voyage block
- transshipment block
- post-carriage / delivery block

Each block may include:

- child events
- interval/inactivity markers
- conflict/uncertainty indicators

These structures must come from canonical read models (or explicit projection contracts), not UI-side semantic reconstruction.
`TERMINAL_MOVE` entries should remain visible operational events and must stay status-neutral in UI behavior.

---

## 6) Dashboard Philosophy

dashboard is high-density operational scan surface.

It should prioritize:

- rapid exception detection
- sortable/filterable operational summaries
- clear severity/status signaling
- compact rows with stable hierarchy

dashboard is not place to re-derive shipment timeline truth.
It prioritizes anomaly detection and operational triage rather than historical detail.
It consumes operational summaries produced by owning contexts and capabilities.

---

## 7) Relationship to Tracking Domain Truth

Tracking remains canonical owner of:

- observation normalization
- event-series grouping
- ACTUAL vs EXPECTED interpretation
- timeline derivation
- status derivation
- alert derivation

UI consumes this truth through DTO/read-model/ViewModel boundaries.
UI must not bypass these boundaries to access domain entities directly.

Invariants remain unchanged:

- snapshots immutable
- observations append-only
- facts preserved (including conflicts)
- uncertainty exposed

---

## 8) Guidance for LLM/Codegen/Design Tools

When generating or refactoring UI:

1. Start from timeline-first shipment composition.
2. Keep sidebar metadata supporting context.
3. Preserve grouped operational blocks in timeline rendering.
4. Favor dense operational clarity over cosmetic minimalism.
5. Never move semantic derivation into UI.
6. If semantic data is missing, request backend projection change.

Companion references:

- visual prompt baseline: `docs/UI_DESIGN_PROMPT.md`
- architecture ownership: `docs/ARCHITECTURE.md`
- boundaries: `docs/BOUNDARIES.md`
- domain truth ownership: `docs/adr/0007-domain-truth-ownership.md`

---

## 9) Summary Principle

UI exists to **expose operational truth clearly**, not to reinterpret it.

Chronology and event history must remain faithful to canonical read models produced by domain.

When presentation and semantics conflict, **domain semantics take precedence**.
