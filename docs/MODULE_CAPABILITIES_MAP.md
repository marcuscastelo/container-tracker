# Container Tracker — Module Capability Map

Este documento é um **mapa operacional** para navegação do monólito modular.
Ele descreve “capabilities internas” *por bounded context* (módulos em `src/modules/*`),
sem conflitar com o conceito de `src/capabilities/*` (features transversais).

Definições rápidas:

- **Bounded Context (BC)**: dono da semântica e regras do domínio (`src/modules/*`).
- **Internal capability** (neste doc): agrupamento funcional para organizar mentalmente o BC
  (ex.: identity, query, reconciliation). Não é uma pasta obrigatória; é um “mapa”.

---

## 1) `container` — internal capabilities

### Visão
`container` é identidade + lifecycle + lookup + persistência do container como entidade física,
associada a `process`.

### A) identity
- Value objects e validações de identidade.
- Onde costuma viver:
  - `domain/identity/*` (ContainerNumber, ContainerId, CarrierCode, ProcessId)

### B) lifecycle
- Criar/remover/atualizar container.
- Onde vive:
  - `application/usecases/create-container.*`
  - `application/usecases/create-many-containers.*`
  - `application/usecases/delete-container.*`

### C) lookup
- Buscar containers por número e vínculos.
- Onde vive:
  - `application/usecases/find-containers-by-number.*`
  - `application/usecases/list-containers-by-process-id.*`
  - `application/usecases/list-containers-by-process-ids.*`
  - `application/usecases/check-container-existence.*`

### D) reconciliation
- Conciliar associação container↔process (best-effort).
- Onde vive:
  - `application/usecases/reconcile-containers.*`

### E) persistence
- Row + mapper + repository supabase.
- Onde vive:
  - `infrastructure/persistence/container.row.ts`
  - `infrastructure/persistence/container.persistence.mappers.ts`
  - `infrastructure/persistence/container.repository.supabase.ts`

### F) bootstrap
- Wiring do módulo.
- Onde vive:
  - `infrastructure/bootstrap/container.bootstrap.ts`

---

## 2) `process` — internal capabilities

### Visão
`process` representa Shipment/Process como agregado e read models operacionais.

### A) identity
- VOs: ids, carrier, source, reference, planned locations.
- Onde vive:
  - `domain/identity/*`

### B) aggregate
- Entidade/aggregate do processo e invariantes.
- Onde vive:
  - `domain/process.entity.ts`
  - `domain/process.types.ts`
  - `domain/process.validation.ts`
  - `domain/process.errors.ts`

### C) lifecycle
- create/update/delete do processo.
- Onde vive:
  - `application/usecases/create-process.*`
  - `application/usecases/update-process.*`
  - `application/usecases/delete-process.*`

### D) association-containers
- Associar/desassociar containers ao processo.
- Onde vive:
  - `application/process.container-usecases.ts`
  - `application/usecases/remove-container-from-process.*`

### E) query
- Buscar/listar processos e read models.
- Onde vive:
  - `application/usecases/find-process-by-id.*`
  - `application/usecases/find-process-by-id-with-containers.*`
  - `application/usecases/list-processes.*`
  - `application/usecases/list-processes-with-containers.*`
  - `application/process.readmodels.ts`
  - `application/shipment.readmodel.ts`
  - `application/process.records.ts`

### F) operational-projection
- Read models canônicos para operação (não UI-ready).
- Onde vive:
  - `application/operational-projection/*`
  - `application/usecases/list-processes-with-operational-summary.*`

### G) persistence
- Row + mapper + repository supabase.
- Onde vive:
  - `infrastructure/persistence/*`

### H) interface-http
- Controllers + schemas + http.mappers.
- Onde vive:
  - `interface/http/*`

### I) ui-shipment-view (nota)
A UI de shipment vive atualmente no módulo `process/ui`.
Isso é aceitável **enquanto** ela não introduzir semântica nem orquestração cross-BC.
Se virar composição cross-BC (dashboard), deve ser promovida para `src/capabilities/*`.

Direção canônica de composição:
- timeline-first no shipment/process detail
- metadados/status/alertas como painéis de suporte (sidebar)
- preservação de blocos operacionais agrupados da timeline quando fornecidos no read model
- sem re-derivação de semântica tracking no frontend

Referência:
- `docs/UI_PHILOSOPHY.md`

---

## 3) `tracking` — internal capabilities

### Visão
`tracking` é o motor event-driven:
snapshots → observations → derive (timeline/status/alerts) + normalizers por carrier.

### A) domain-model
- Tipos e contratos do domínio tracking.
- Onde vive:
  - `domain/model/*`

### B) domain-derive
- Regras puras de derivação.
- Onde vive:
  - `domain/derive/*`

### C) domain-reconcile
- expected vs actual, séries, safe-first.
- Onde vive:
  - `domain/reconcile/*`

### D) domain-identity
- fingerprinting/idempotência.
- Onde vive:
  - `domain/identity/*`

### E) domain-logistics
- Regras logísticas derivadas (ex.: transshipment).
- Onde vive:
  - `domain/logistics/*`

### F) orchestration-pipeline
- Orquestração de ingestão/normalização/diff/persist.
- Onde vive:
  - `application/orchestration/*`

### G) projection/readmodels
- Read models semânticos (não UI-ready) + resolvers de display mínimos.
- Onde vive:
  - `application/projection/*`
  - **Nota**: timeline agora expõe read model sem strings finais:
    - `application/projection/tracking.timeline.readmodel.ts`

### H) persistence + carriers
- Fetchers/normalizers + repositories.
- Onde vive:
  - `infrastructure/carriers/*`
  - `infrastructure/persistence/*`

---

## 4) Cross-cutting Capabilities (src/capabilities/*)

As capabilities em `src/capabilities/*` são features transversais (Ctrl+K search, dashboard etc.).
Elas podem depender de BCs (application layer) e compor read models.
Elas não devem importar `modules/*/domain`.
