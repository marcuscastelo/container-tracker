# modules/tracking

1. Propósito do Módulo

- Bounded context: motor canônico de rastreamento e normalização (Snapshot → Observations → Timeline → Status → Alerts).
- Responsável por: ingestão e persistência de snapshots de carriers, normalização em `ObservationDraft[]`, deduplicação por `fingerprint`, derivação de timeline e status monotônico e geração de alerts (fact-based e monitoring).
- NÃO responsável por: decisões de apresentação/UI; não deve conter componentes de UI. Não é responsável por CRUD de `Process` (veja `process` module) — apenas pelo tracking dos containers.

2. Estrutura interna (presente nesta pasta)

- domain/
  - regras puras: `snapshot.ts`, `observationDraft.ts`, `observation.ts`, `deriveTimeline.ts`, `deriveStatus.ts`, `deriveAlerts.ts`, `fingerprint.ts`, `transshipment.ts`.
- application/
  - orquestração da pipeline: `pipeline.ts`, coordenadores de diff/persistência e apresentadores (`tracking.alert.presenter`, `tracking.timeline.presenter`).
- infrastructure/
  - adaptadores e persistência: normalizadores por provider (`mscNormalizer.ts`, etc.), repositórios Supabase (`supabaseSnapshotRepository.ts`, `supabaseObservationRepository.ts`, `supabaseTrackingAlertRepository.ts`).
- interface/
  - adaptadores HTTP/DTOs quando presentes (ex.: endpoints de refresh/processamento) — manter controllers finos que mapearão Request → Command.

3. Fluxo interno (pipeline resumida)

1. Persistir snapshot bruto em `container_snapshots`.
2. `normalizeSnapshot(snapshot)` → `ObservationDraft[]` (dispatcher por provider).
3. `diffObservations(existingFingerprints, drafts)` → novos `Observation[]` (deduplicação por `fingerprint`).
4. Persistir novas observations em `container_observations`.
5. `deriveTimeline(observations)` → Timeline (detecta buracos, series de eventos).
6. `deriveStatus(timeline)` → ContainerStatus (monotônico, por dominância).
7. `deriveAlerts(timeline, status, ...)` → novos alerts (fact vs monitoring, retroatividade controlada).

4. Tipos principais (arquivo / camada)

- `ObservationDraft` — `src/modules/tracking/domain/observationDraft.ts` (Domain input).
- `Observation` — `src/modules/tracking/domain/observation.ts` (Domain persisted fact).
- `fingerprint` — `src/modules/tracking/domain/fingerprint.ts` (determinismo para deduplicação).
- `ContainerStatus` — `src/modules/tracking/domain/containerStatus.ts`.
- `Snapshot` — `src/modules/tracking/domain/snapshot.ts`.
- Alert types — `src/modules/tracking/domain/trackingAlert.ts`.

5. Regras arquiteturais do módulo

- Snapshots são imutáveis — sempre persista o payload bruto antes de normalizar.
- Normalização e regras puras vivem em `domain/`; persistência é função de `application` + `infrastructure`.
- Use `zod.safeParse` em pontos de entrada para validar dados externos e evitar `any`/`as`.
- Fingerprint é calculado a partir de campos semânticos relevantes (não usar `event_id` do carrier).
- Repositórios de persistência devem lançar exceções em erro e serem implementados em `infrastructure/`.

6. Pontos sensíveis / armadilhas

- Não confiar em ordering/timestamps das APIs externas — normalize e calcule event_time com heurísticas claras.
- Evitar gerar alerts de monitoring retroativamente; apenas alerts fact podem ser retroativos e devem ser marcados com `retroactive: true`.
- Não remover observations antigas; novas observations são adicionadas e a timeline é derivada a partir do histórico.
- Fingerprint collisions: quando em dúvida, persista ambos e gere um alert de `data` para revisão humana.

7. Evolução futura (curto)

- Expandir adaptadores para novos carriers com testes de normalização.
- Expor hooks/metrics de observability (Sentry/OTel) em pontos críticos de parsing.
- Melhorar heurísticas de previsão de ETA e integrar com presenter do `process` para exibir previsões.

Referências rápidas

- Implementação da pipeline: `src/modules/tracking/application/pipeline.ts`
- Tests de domínio: `src/modules/tracking/domain/tests/` (golden tests)
- SQL DDL de exemplo: consulte comentários em `src/modules/tracking/README.md` no repositório ou as migrações correspondentes.
