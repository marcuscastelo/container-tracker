# Tracking Critical Coverage Matrix

## Purpose

This matrix complements numeric coverage with semantic visibility for the canonical
tracking pipeline:

`Snapshot -> Observation -> Series -> Timeline -> Status -> Alerts`

The goal is to make explicit which critical areas already have meaningful suites,
where edge cases are protected, and which gaps still need backlog attention even
when the aggregate coverage numbers look healthy.

## Matrix

| Area | Existe suite? | Happy path | Edge cases | Suites atuais | Gaps |
| --- | --- | --- | --- | --- | --- |
| observation | sim | sim | sim | `src/modules/tracking/features/observation/application/tests/diffObservations.test.ts`; `src/modules/tracking/domain/tests/fingerprint.test.ts`; `src/modules/tracking/application/tests/pipeline.integration.test.ts` | A policy v0 ainda nao destaca explicitamente append-only/raw-payload preservation como item semantico visivel no inventario. |
| series | sim | sim | sim | `src/modules/tracking/features/series/domain/reconcile/tests/seriesClassification.test.ts`; `src/modules/tracking/features/series/domain/reconcile/tests/reconcileForDisplay.test.ts`; `src/modules/tracking/features/series/domain/reconcile/tests/expiredExpected.test.ts`; `src/modules/tracking/features/series/domain/reconcile/tests/canonicalSeries.test.ts` | Falta expor no artefato manual, de forma resumida, que safe-first, conflito entre multiplos ACTUAL e redundancia apos ACTUAL ja estao protegidos. |
| timeline | sim | sim | sim | `src/modules/tracking/features/timeline/domain/tests/deriveTimeline.test.ts`; `src/modules/tracking/features/timeline/application/projection/tests/tracking.timeline.readmodel.test.ts`; `src/modules/tracking/features/timeline/application/projection/tests/tracking.timeline.blocks.readmodel.test.ts`; `src/modules/tracking/features/timeline/application/projection/tests/tracking.timeline.actual-voyage-conflict.readmodel.test.ts`; `src/modules/tracking/features/timeline/application/projection/tests/tracking.timeline.voyage-expected-substitution.readmodel.test.ts` | A v0 ainda nao separa explicitamente, no report, a cobertura de derivacao de timeline vs read model timeline-first. |
| status | sim | sim | sim | `src/modules/tracking/features/status/domain/tests/deriveStatus.test.ts`; `src/modules/tracking/features/status/domain/tests/deriveStatus.transshipmentProtection.test.ts`; `src/modules/tracking/features/status/domain/tests/deriveStatus.deliveryGateOut.test.ts`; `src/modules/tracking/features/status/domain/tests/deriveStatus.emptyGateOut.test.ts`; `src/modules/tracking/features/status/application/projection/tests/tracking.status.projection.test.ts` | Monotonicidade e protecao de regressao estao cobertas nos testes, mas ainda nao aparecem como marcador explicito no inventario de policy. |
| alerts | sim | sim | parcial | `src/modules/tracking/features/alerts/domain/tests/deriveAlerts.test.ts`; `src/modules/tracking/features/alerts/application/projection/tests/tracking.alert.projection.test.ts`; `src/modules/tracking/features/alerts/application/projection/tests/tracking.alert-display.readmodel.test.ts`; `src/modules/tracking/features/alerts/application/usecases/tests/list-active-alert-read-model.usecase.test.ts`; `src/modules/tracking/application/tests/pipeline.alert-idempotency.integration.test.ts` | Fact alerts estao fortes; monitoring alerts ainda precisam de visibilidade semantica mais explicita, principalmente separando melhor fact vs monitoring no inventario. |

## Initial Gap Inventory

- `alerts`: destacar explicitamente no backlog a diferenca entre fact alerts e monitoring alerts; hoje a leitura agregada favorece transshipment/customs/fact semantics.
- `observation`: adicionar backlog especifico para tornar visivel, na policy, a protecao de snapshot immutability, raw payload preservation e append-only semantics.
- `timeline`: melhorar a leitura do report para deixar claro que o BC cobre tanto derivacao cronologica quanto o contrato consumido pela UI timeline-first.
- `status`: promover monotonicidade a item nomeado no inventario, em vez de depender apenas da leitura das suites.
- `process/ui` adjacente: existe boa cobertura de composicao e grouping em `src/modules/process/ui/timeline/tests/timelineBlockModel.test.ts`, mas ainda nao aparece como contrato de "consome verdade derivada sem rederivacao" na policy de coverage.

## Notes

- This matrix is intentionally manual in v0.
- The numeric baseline lives in `docs/plans/coverage-baseline.json` and `docs/plans/coverage-baseline.md`.
- The CI artifact/report complements this file; it does not replace semantic review.
