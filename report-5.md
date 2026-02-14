ProviderCoverage:
- Observation persistence (where Observations are persisted):
  - Interface: src/modules/tracking/application/tracking.observation.repository.ts
  - Supabase implementation: src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts
  - Persistence mappers (insert/read row mappings): src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts
  - Domain schema: src/modules/tracking/domain/observation.ts
  - Note: insertion flow uses observationToInsertRow → supabase.from('container_observations').insert(rows)

- Normalizers (where location_code/display are produced in drafts):
  - Maersk normalizer: src/modules/tracking/infrastructure/adapters/maersk.normalizer.ts
    - location_code derived as: event.locationCode ?? location.location_code ?? null
    - location_display derived from city/country_code
  - MSC normalizer: src/modules/tracking/infrastructure/adapters/msc.normalizer.ts
    - event.UnLocationCode → location_code (may be absent)
    - PodEtaDate ETA draft explicitly sets location_code = null and uses PortOfDischarge for location_display
      (see: generation of ETA draft in normalizeMscSnapshot)
  - CMA-CGM normalizer: src/modules/tracking/infrastructure/adapters/cmacgm.normalizer.ts
    - location_code = move.LocationCode ?? null
    - location_display = move.Location ?? null

- Where transshipment derivation relies on location_code:
  - deriveTransshipment: src/modules/tracking/domain/deriveAlerts.ts (function deriveTransshipment)
    - Implementation: only counts LOAD/DISCHARGE/ARRIVAL/DEPARTURE observations that have obs.location_code truthy
  - UI uses display fallback (location_display ?? location_code) in:
    - src/modules/tracking/application/tracking.timeline.presenter.ts


Evidence from tests / examples (cases where code is null but display present):
- MSC ETA case: test asserts an EXPECTED ARRIVAL draft with location_display present while code is set to null in normalizer
  - Test: src/modules/tracking/infrastructure/tests/mscNormalizer.test.ts
    - See test: "should generate EXPECTED observation from PodEtaDate when future" which checks
      etaDraft?.location_display === 'ITAPOA, BR'
  - Normalizer: src/modules/tracking/infrastructure/adapters/msc.normalizer.ts
    - podLocationCode is intentionally null for PodEtaDate (commented in code)

- Several normalizer tests assert location_code when available (Maersk / MSC / CMA-CGM fixtures), e.g.:
  - Maersk tests: src/modules/tracking/infrastructure/tests/maerskNormalizer.test.ts (expects location_code like 'EGPSDTM')
  - CMA-CGM tests: src/modules/tracking/infrastructure/tests/cmacgmNormalizer.test.ts (expects location_code like 'ESZAZ')


TransshipmentRisk:
- deriveTransshipment currently ignores observations without a non-null location_code (src/modules/tracking/domain/deriveAlerts.ts).
- Because some carriers (notably MSC's PodEtaDate-derived ETA) produce records with location_display but no UN/LOCODE (location_code=null), transshipment detection can miss legs where the only available evidence is a human-readable port name.
- Examples where this can happen:
  - MSC — ETA creation sets location_code = null and relies on location_display (src/modules/tracking/infrastructure/adapters/msc.normalizer.ts + test in mscNormalizer.test.ts)
  - Other carriers may occasionally omit UN/LOCODE in some event types (CMA-CGM: move.LocationCode may be absent; Maersk: event.locationCode may be absent) — see respective normalizers.

Recommendation:
- C) exigir enrichment via resolver antes da derivação

Justificativa (5 linhas):
- Relying only on free-text display risks both false positives (ambiguous names) and false negatives (missing codes). A conservative, code-only rule avoids false positives but currently loses some true transshipment evidence (e.g., MSC ETA). The safest long-term fix is to enrich observations (map location_display → canonical UN/LOCODE) via a resolver/enrichment step before running deriveTransshipment and alert derivation. This keeps detection deterministic and auditable while allowing high recall once enrichment quality is validated.


Files/paths cited (summary):
- src/modules/tracking/application/tracking.observation.repository.ts
- src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts
- src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts
- src/modules/tracking/domain/observation.ts
- src/modules/tracking/infrastructure/adapters/maersk.normalizer.ts
- src/modules/tracking/infrastructure/adapters/msc.normalizer.ts
- src/modules/tracking/infrastructure/adapters/cmacgm.normalizer.ts
- src/modules/tracking/domain/deriveAlerts.ts
- src/modules/tracking/application/tracking.timeline.presenter.ts
- Tests referenced:
  - src/modules/tracking/infrastructure/tests/mscNormalizer.test.ts
  - src/modules/tracking/infrastructure/tests/maerskNormalizer.test.ts
  - src/modules/tracking/infrastructure/tests/cmacgmNormalizer.test.ts


Notes / next steps (optional):
- If desired, I can implement a short enrichment prototype that maps common location_display strings from fixtures to UN/LOCODE (configurable mapping), run unit tests, and measure how many additional transshipment detections it enables. This would demonstrate trade-offs between conservative and enriched derivation.
