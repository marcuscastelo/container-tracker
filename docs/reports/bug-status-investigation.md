# Investigation Report

## Update — 2026-03 MSC Hardening Applied

MSC hardening series has already implemented key normalization corrections discussed in this report.

Current canonical behavior for MSC positioned events:

- `Full Transshipment Positioned In` -> `TERMINAL_MOVE`
- `Full Transshipment Positioned Out` -> `TERMINAL_MOVE`
- never mapped to `ARRIVAL`

Additional hardening now active:

- contextual `Detail` parsing (vessel/voyage only for vessel-like events)
- `LADEN`/`EMPTY` blocked vessel names
- `raw_event.normalizer_version` metadata on MSC drafts (`msc-v2`)
- regression tests for real transshipment timelines and semantic-audit helpers

Historical analysis below remains useful for context, but mapping recommendations that suggested promoting positioned events to `ARRIVAL`/`LOAD` are superseded by `TERMINAL_MOVE`.

## Bug 1 — CA083-25
### Symptom
- Timeline shows full flow (transshipments, arrival in SANTOS, discharge, delivery, gate-out)
- UI status remains `DISCHARGED` ("Descarregado") instead of advancing to `DELIVERED` or `EMPTY_RETURNED` after terminal `GATE_OUT`/empty-return-like event

### Root cause (validated in code)
- Primary cause: carrier-normalized event type + status derivation mismatch. Maersk normalizer maps some "empty" labels to `GATE_OUT` (see `MAERSK_ACTIVITY_MAP`) and/or produces `GATE_OUT` with `is_empty=true` instead of canonical `EMPTY_RETURN`. status derivation (`deriveStatus`) only considers `EMPTY_RETURN` (and `DELIVERY`) terminal states — it does not consider `GATE_OUT` nor `is_empty` on `GATE_OUT` when advancing status.
- Contributing factor: `deriveStatus` precedence table and checks (file: `src/modules/tracking/features/status/domain/derive/deriveStatus.ts`) do not inspect `is_empty` on observations and do not include `GATE_OUT` in dominance checks.

### Code path (exact files & functions inspected)
- Carrier normalizer (Maersk):
  - File: `src/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer.ts`
  - Function: `normalizeMaerskSnapshot`
  - Behavior: maps various activity strings via `MAERSK_ACTIVITY_MAP` (e.g. `'empty return' -> 'EMPTY_RETURN'`, but also maps some labels such `'empty to shipper'` → `'GATE_OUT'`). It also sets `is_empty` from `event.stempty` and places it on produced `ObservationDraft`.
- Status derivation:
  - File: `src/modules/tracking/features/status/domain/derive/deriveStatus.ts`
  - Function: `deriveStatus(timeline: Timeline): ContainerStatus`
  - Behavior: computes `finalLocation`, then uses predicates like `hasActualOfType('EMPTY_RETURN')`, `hasActualOfType('DELIVERY')`, `hasActualDischargeAtFinal()` etc. It never inspects `is_empty` or treats `GATE_OUT` equivalent to `EMPTY_RETURN` when computing final status.
- Pipeline orchestration (confirms ordering):
  - File: `src/modules/tracking/application/orchestration/pipeline.ts`
  - Behavior: `deriveTimeline` → `deriveStatus` → `deriveAlerts` → `deriveTransshipment` (i.e., status derived before explicit transshipment detection).

### Why it is wrong semantically
- `GATE_OUT` that represents empty return semantically corresponds to domain terminal `EMPTY_RETURNED` state. If normalizer leaves such events `GATE_OUT` (even when `is_empty=true`), canonical status derivation will not advance to `EMPTY_RETURNED` because it only looks for `EMPTY_RETURN` typed observations. result is stale `DISCHARGED` status even though operationally container was returned/emptied.

### Correct ownership
- Tracking BC (normalizer + status derivation) owns semantics. Fix belongs to Tracking BC:
  - Prefer correction in carrier normalizer so that domain semantics (EMPTY_RETURN) are produced at ingestion, or
  - If ambiguous in provider labels, make `deriveStatus` aware of `is_empty` on `GATE_OUT` observations (domain logic change).

### Minimal safe fix (recommendation, no implementation in this report)
Two complementary minimal options (pick one first PR):

1) Normalizer-first, authoritative (preferred semantic fix):
   - In `src/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer.ts` (function `normalizeMaerskSnapshot`), after building `type` and reading `isEmpty` (`event.stempty`), add narrow rule:
     - If `type === 'GATE_OUT' && isEmpty === true` then set `type = 'EMPTY_RETURN'` and preserve `carrier_label`/`is_empty` for audit. This keeps domain semantics correct at ingestion and preserves auditability.
   - Add equivalent defensive mapping in `msc.normalizer.ts` (and any other carrier normalizer that maps ambiguous "empty" labels to `GATE_OUT`).

2) Defensive status-derivation (complementary / fallback):
   - In `src/modules/tracking/features/status/domain/derive/deriveStatus.ts`, add predicate checked before `DISCHARGED` that treats ACTUAL `GATE_OUT` with `is_empty === true` `EMPTY_RETURNED` (same dominance `EMPTY_RETURN`). Example: `if (timeline.observations.some(o => o.event_time_type === 'ACTUAL' && o.type === 'GATE_OUT' && o.is_empty === true)) return 'EMPTY_RETURNED'`.
   - This is defensive (handles imperfect normalizers) but less authoritative than fixing normalizers.

Both approaches preserve auditability; prefer normalizer change canonical source-of-truth.

### Regression tests needed
- Add invariant test similar to existing `emptyReturnMapping.invariants.test.ts` but with ambiguous label that previously produced `GATE_OUT` (e.g., 'Empty to Shipper' or provider-specific label seen in failing snapshot). Test should verify:
  - Normalizer produces `EMPTY_RETURN` or, if you choose deriveStatus change, that `deriveStatus` returns `EMPTY_RETURNED` when given timeline containing ACTUAL `GATE_OUT` with `is_empty === true`.
  - timeline series grouping is preserved and `deriveAlerts` still produces no spurious alerts.

Suggested test file(s):
- `src/modules/tracking/infrastructure/carriers/tests/maerskEmptyGateOut.invariants.test.ts` (normalizer variant)
- `src/modules/tracking/features/status/domain/tests/deriveStatus.emptyGateOut.test.ts` (deriveStatus defensive variant)


## Bug 2 — CA064-25
### Symptom
- Timeline shows: LOAD (Karachi) → DISCHARGE (Busan) → transshipment block → LOAD (Busan → Santos) → historically, `Full Transshipment Positioned In` appeared `OTHER` ("Não mapeado"). ETA predicted for Santos.
- UI status remains `DISCHARGED` despite subsequent ACTUAL LOAD onto different vessel (i.e., container was transshipped and is now in transit to final POD).

### Root cause (validated in code)
- Primary cause (mapping gap): carrier normalizer did not map provider's event label `Full Transshipment Positioned In` to canonical `TERMINAL_MOVE`, resulting in `OTHER` observations. Missing mapping caused read-model's final-location selection to prefer earlier `DISCHARGE` last lifecycle event.
- Primary cause B (derivation ordering / logic): `deriveStatus` uses final-location heuristic (walks timeline from end and picks first `DISCHARGE|ARRIVAL|DELIVERY` with `location_code`). Because `deriveStatus` is executed before `deriveTransshipment` in pipeline, and because `deriveStatus` does not consider presence of subsequent ACTUAL `LOAD` (transshipment), DISCHARGE at transshipment port may be treated final and advance status to `DISCHARGED`.
- Contributing factor: observation normalization (missing mapping) + reconciliation rules that may remove or collapse expected events leading to finalLocation pointing to wrong event.

### Code path (exact files & functions inspected)
- MSC normalizer (example):
  - File: `src/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer.ts`
  - Function: `normalizeMscSnapshot`
  - Behavior: maps many 'Full Transshipment...' descriptions (e.g. `'full transshipment loaded' -> 'LOAD'`, `'full transshipment discharged' -> 'DISCHARGE'`). Historically, `'Full Transshipment Positioned In'` was missing and became `'OTHER'`; current hardening maps positioned labels to `TERMINAL_MOVE`.
- Timeline read-model and series classification:
  - Files: `src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts` and `src/modules/tracking/features/series/domain/reconcile/seriesClassification.ts`
  - Behavior: groups by series (`buildSeriesKey`) and classifies safe-first primary. `deriveTimeline` collapses redundant EXPECTED and returns ordered `observations` used by `deriveStatus`.
- Status derivation ordering & logic:
  - File: `src/modules/tracking/features/status/domain/derive/deriveStatus.ts`
  - Function: `deriveStatus` finds `finalLocation` by scanning timeline from end for first `DISCHARGE|ARRIVAL|DELIVERY` with `location_code`. Because un-mapped `Full Transshipment Positioned In` was `OTHER`, it was ignored and last matching item became DISCHARGE at transshipment → `hasActualDischargeAtFinal()` returned true → status `DISCHARGED`.
  - Pipeline ordering confirmed in `src/modules/tracking/application/orchestration/pipeline.ts`: status derived before transshipment detection.

### Why it is wrong semantically
- DISCHARGE at transshipment port is not semantically final POD unload. If container was subsequently LOADED onto different vessel (ACTUAL LOAD after DISCHARGE), canonical status should reflect that container is again in-transit (or loaded) toward its POD, not `DISCHARGED` at transshipment port. Treating transshipment DISCHARGE final hides operational truth and breaks monitoring/alerts.

### Correct ownership
- Tracking BC owns normalization and status derivation. Fixes must remain in tracking: normalizers and status derivation. UI must not patch semantics.

### Minimal safe fixes (recommendations, no implementation in this report)
- Two complementary minimal fixes to address both mapping coverage and derivation semantics:

1) Mapping patch (low-risk):
   - Add missing mapping entries to carrier normalizers for provider phrases observed in failing snapshots (map `'Full Transshipment Positioned In/Out'` → `TERMINAL_MOVE`). Files to change:
     - `src/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer.ts`
     - `src/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer.ts` (if Maersk uses similar strings)
   - Rationale: many cases are simple synonyms; mapping them preserves domain semantics at ingestion and fixes downstream selection of `finalLocation`.

2) Status-derivation safety net (important behavioral fix):
   - In `src/modules/tracking/features/status/domain/derive/deriveStatus.ts`, strengthen `DISCHARGED` decision to detect subsequent ACTUAL `LOAD` events (transshipment) that occur after DISCHARGE at candidate `finalLocation`. Concretely:
     - When evaluating `hasActualDischargeAtFinal()`, identify the latest ACTUAL DISCHARGE at that finalLocation and ensure there is no ACTUAL LOAD with `event_time` > discharge.event_time. If a later ACTUAL LOAD exists, the DISCHARGE is not final and should not advance status to `DISCHARGED`.
   - Alternatively (or), compute `transshipment` earlier in pipeline and have `deriveStatus` accept small hint parameter (e.g., `isTransshipped`) — but modifying `deriveStatus` to be self-contained (inspect timeline for post-discharge LOAD) is minimal-intrusive approach.

Note: do NOT change UI or move derivation to capabilities. Keep invariants: snapshots immutable, observations append-only, status derived.

### Regression tests needed
- Create regression test that reproduces failing sequence (Karachi LOAD ACTUAL → Busan DISCHARGE ACTUAL → Busan LOAD ACTUAL → provider event labelled `Full Transshipment Positioned In` unmapped). Ensure pipeline-derived status is not `DISCHARGED`.

Suggested test files and assertions:
- `src/modules/tracking/features/status/domain/tests/deriveStatus.transshipmentProtection.test.ts`
  - Build domain `Observation[]` fixture with explicit event_time ordering and vessel names that show vessel change.
  - Use `deriveTimeline(...)` then `deriveStatus(timeline)` and assert status === `'IN_TRANSIT'` (or `'LOADED'` per product spec), not `'DISCHARGED'`.

- `src/modules/tracking/infrastructure/carriers/tests/mscPositionedMapping.test.ts`
  - Provide MSC-style payload containing `Full Transshipment Positioned In`.
  - Assert normalizer produces `TERMINAL_MOVE` and that status derivation remains non-arrival-like when later ACTUAL `LOAD` exists.


## Cross-cutting findings
- enum/model gaps
  - `deriveStatus` relies on observation `type` values but does not inspect `is_empty`. There is mode gap between semantic `EMPTY_RETURN` and `GATE_OUT + is_empty === true`.

- lifecycle-event selection issues
  - `deriveStatus` computes `finalLocation` by scanning for `DISCHARGE|ARRIVAL|DELIVERY` only; that heuristic is brittle when carriers emit alternative labels that end up `OTHER` or when `LOAD` events after `DISCHARGE` indicate transshipment.

- discharge-at-transshipment vs discharge-at-POD ambiguity
  - Current logic will treat discharge final if later lifecycle events are missing or unmapped. status derivation must be robust to detect subsequent ACTUAL `LOAD` (transshipment) and ignore intermediate discharges for final-status decisions.

- whether `OTHER` incorrectly affects status derivation
  - Yes — unmapped provider labels reduce set of lifecycle indicators available to `deriveStatus`, causing it to fall back to earlier lifecycle events (e.g., DISCHARGE at transshipment). Mapping coverage should be expanded for commonly observed carrier phrasing.

- whether provider normalizers are under-modeled
  - Observed: some provider phrases are intentionally or accidentally mapped to `GATE_OUT` or `OTHER` while payload contains `is_empty` or clear transshipment semantics. Normalizers should be reviewed and have targeted mappings for known carrier phrase variants.


## Tests coverage audit (what exists / missing)
- Existing tests found
  - `src/modules/tracking/infrastructure/carriers/tests/maerskNormalizer.test.ts` — validates many Maersk mappings including `GATE_OUT`/`EMPTY_RETURN` cases.
  - `src/modules/tracking/infrastructure/carriers/tests/mscNormalizer.test.ts` — includes `Full Transshipment Discharged` mapping tests.
  - `src/modules/tracking/infrastructure/carriers/tests/emptyReturnMapping.invariants.test.ts` — asserts `EMPTY_RETURN` → `EMPTY_RETURNED` flow via deriveStatus derivation when normalizer returns `EMPTY_RETURN`.
  - `src/modules/tracking/features/alerts/domain/tests/deriveAlerts.test.ts` — covers transshipment detection logic (DISCHARGE→LOAD vessel change pairs) at alert derivation level.

- Missing / weak coverage (to add)
  - Regression for ambiguous empty-return labels that are currently mapped to `GATE_OUT` (ensure either normalizer or deriveStatus handles `is_empty` correctly).
  - Regression for transshipment positioned phrases (`Full Transshipment Positioned In/Out`) — ensure mapping is `TERMINAL_MOVE` and pipeline does not select arrival/discharge-like terminal status when later ACTUAL `LOAD` exists.
  - unit test for `deriveStatus` ensuring that if ACTUAL `DISCHARGE` at `L1` is followed by ACTUAL `LOAD` (vessel changed) later, status does not become `DISCHARGED`.


## Actionable next steps (minimal PRs suggested)
1. Small PR: normalize `GATE_OUT` + `is_empty === true` → `EMPTY_RETURN` in `maersk.normalizer.ts` (and optionally `msc.normalizer.ts`) and add unit test (`maerskEmptyGateOut.invariants.test.ts`). This addresses Bug 1 directly with minimal surface area.
2. Small PR: strengthen `deriveStatus` to avoid treating DISCHARGE final if later ACTUAL LOAD exists after that discharge (add unit test `deriveStatus.transshipmentProtection.test.ts`). This prevents Bug 2 class of failures even when provider emits unmapped label.
3. Add/keep explicit mapping for `Full Transshipment Positioned In/Out` in MSC/Maersk normalizers `TERMINAL_MOVE`. Add carrier-mapping tests and end-to-end pipeline test asserting derived status is not arrival/discharge-like after later ACTUAL `LOAD`.

Notes:
- Prefer making normalizer change first for semantic correctness; add defensive deriveStatus guard follow-up for robustness.
- Keep all changes limited to Tracking BC (normalizers / deriveStatus); do not change UI.

---
Saved at: docs/reports/bug-status-investigation.md
