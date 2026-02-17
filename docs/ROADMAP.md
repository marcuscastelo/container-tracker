# Container Tracker — Roadmap

## Architecture Status

✔ Bounded Context separation stabilized  
✔ Capabilities folder introduced  
✔ Timeline split (semantic read model vs UI presenter)  
✔ ACTUAL vs EXPECTED classification implemented  
✔ Event series safe-first logic implemented  

---

## Short Term

- Remove ObservationResponse dependency from tracking readmodel
- Introduce internal TrackingObservationDTO
- Formalize shared kernel policy
- Add ESLint boundary rules

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
- Domain duplication vs shared kernel decision pending
- ProcessOperationalSummary still needs boundary tightening

---

Goal:

Stabilize architecture before feature expansion.
