# Container Tracker — Roadmap

## Architecture Status

✔ Bounded Context separation stabilized  
✔ Capabilities folder introduced  
✔ Timeline split (semantic read model vs UI presenter)  
✔ ACTUAL vs EXPECTED classification implemented  
✔ Event series safe-first logic implemented  
✔ Shared kernel policy formalized (`ADR-0004`)  
✔ Quality gate CI (`lint`, `type-check`, `test`)  

---

## Short Term

- Enforce boundary rules continuously in PR checks
- Consolidate residual UI mapping cleanup in process/tracking screens
- Monitor false-positives from new eslint boundary overrides

---

## Medium Term

- Introduce dashboard capability module
- Extract search ranking improvements
- Materialized operational summaries
- Alert caching optimization

---

## Long Term

- Snapshot ingestion optimization
- Background processing workers
- Observability layer
- Advanced search scoring
- Carrier abstraction layer stabilization

---

## Technical Debt

- Some cross-layer imports still exist
- ProcessOperationalSummary still needs boundary tightening

---

Goal:

Stabilize architecture before feature expansion.
