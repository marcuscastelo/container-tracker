# Technical Debt - Global Search (PR #85)

## Context

This register captures technical debt intentionally left after the functional fixes merged in PR #85 (`6cc1984`).

Applied in PR #85:
- deterministic tracking field merge per `processId` in capability;
- container search process-limit fix before capability consolidation;
- search overlay accessibility and modal behavior improvements;
- documentation alignment for ranking behavior.

Not applied in PR #85 (tracked below): structural scalability and projection-contract refactors.

---

## 1) Process text search still scans all processes in memory

Current state:
- `search-processes-by-text.usecase.ts` loads all processes via `repository.fetchAll()` and filters in-memory.

Impact:
- high CPU/memory and full-table transfer on each search request.

Risk:
- high when process volume grows.

Future correction:
- add repository method with server-side filtering (`ilike`/`or`) plus `limit`;
- keep read-model mapping in application layer.

Trigger to pay:
- before production scale-up or before enabling larger tenants.

---

## 2) Container search still loads full projection set per query

Current state:
- `listSearchProjections()` reads full `containers` projection and filtering happens in use case.

Impact:
- repeated full-table read per search.

Risk:
- medium to high with large container volume.

Future correction:
- introduce repository query with `query + limit` server-side filtering (and proper index strategy on `container_number`).

Trigger to pay:
- before search traffic increases materially.

---

## 3) Tracking search observation retrieval is not scalable

Current state:
- `listSearchObservations()` performs unfiltered `select('*')` on `container_observations`;
- then does a second query with large `IN (containerIds...)` against `containers`.

Impact:
- expensive read path and possible PostgREST URL/parameter limit issues.

Risk:
- high with long observation history.

Future correction:
- move to server-side join/projection strategy;
- reduce selected columns to search-required fields only;
- consider dedicated read model/materialized projection for search.

Trigger to pay:
- before historical data growth degrades `/api/search` latency.

---

## 4) Vessel/status search still derives all tracking projections before filtering

Current state:
- `search-tracking-by-vessel-name` and `search-tracking-by-derived-status-text` call `listTrackingSearchProjections()` for all records, then filter.

Impact:
- timeline/status/ETA derivation cost paid for non-matching records.

Risk:
- high on larger datasets.

Future correction:
- support server-side filtering in persistence or maintain dedicated projection keyed by searchable fields.

Trigger to pay:
- before enabling search as primary operational entrypoint for large accounts.

---

## 5) Tracking search projection granularity is ambiguous

Current state:
- `deriveTrackingSearchProjections()` is container-level internally but returns type keyed by `processId` only.

Impact:
- downstream layers can misinterpret granularity and accidentally mix container/process semantics.

Risk:
- medium semantic drift risk.

Future correction:
- either expose container identifiers in projection contract;
- or aggregate canonically to one process-level projection inside Tracking BC.

Trigger to pay:
- before extending ranking logic or cross-field aggregation rules.

---

## 6) Consolidation limit can still underfill unique process count in some BC mixes

Current state:
- capability still passes `limit=30` per BC;
- BCs that return many rows per process can reduce unique process count after final dedup.

Impact:
- fewer than 30 unique process rows returned even when more valid matches exist.

Risk:
- medium relevance/coverage loss.

Future correction:
- adopt over-fetch factor per BC and cap after consolidation;
- or require BC search contracts to return process-deduplicated rows.

Trigger to pay:
- when search quality metrics show missing expected rows for broad queries.

