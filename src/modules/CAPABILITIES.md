# Capabilities por Módulo — `container` / `process` / `tracking`

Meta: introduzir uma organização “por capabilities” **sem quebrar o guia** (camadas ainda existem: domain/application/infrastructure/interface/ui), mas reduzindo “arquivos soltos” e facilitando navegação mental.

Regra: **capability = porquê/objetivo funcional**, não por tipo técnico.

---

## 1) `container` — capabilities

### Visão

O módulo `container` é essencialmente CRUD + lookup + reconcile com `process`.

### Capabilities propostas

#### A) `identity`

* O que é: tudo relacionado à identidade do container (IDs, número, carrier code) e suas validações.
* Onde vive:

  * `domain/value-objects/*` (container-id, container-number, carrier-code, process-id)
  * `domain/container.validation.ts` (validação semântica)

#### B) `lifecycle`

* O que é: criação/remoção/atualização de containers.
* Onde vive:

  * `application/usecases/create-container.*`
  * `application/usecases/create-many-containers.*`
  * `application/usecases/delete-container.*`

#### C) `lookup`

* O que é: buscar containers por número e por vínculo com processos.
* Onde vive:

  * `application/usecases/find-containers-by-number.*`
  * `application/usecases/list-containers-by-process-id.*`
  * `application/usecases/list-containers-by-process-ids.*`
  * `application/usecases/check-container-existence.*`

#### D) `reconciliation`

* O que é: reconciliar estado/listas de containers associados ao process.
* Onde vive:

  * `application/usecases/reconcile-containers.*`

#### E) `persistence`

* O que é: row + mapper + repository supabase.
* Onde vive:

  * `infrastructure/persistence/container.row.ts`
  * `infrastructure/persistence/container.persistence.mappers.ts`
  * `infrastructure/persistence/container.repository.supabase.ts`

#### F) `bootstrap`

* O que é: wiring do módulo.
* Onde vive:

  * `infrastructure/bootstrap/container.bootstrap.ts`

> Nota: `container` hoje não tem `interface/http` próprio — ele é consumido por `process`/UI. Se no futuro tiver HTTP, vira uma capability “interface/http”.

---

## 2) `process` — capabilities

### Visão

O módulo `process` é o “Shipment/Process aggregate” + queries (readmodels) + projeções operacionais.

### Capabilities propostas

#### A) `identity`

* O que é: value objects (ids, carrier, source, reference, planned locations).
* Onde vive:

  * `domain/value-objects/*`
  * `domain/value-objects.ts` (re-export / barrel se existir)

#### B) `aggregate`

* O que é: entidade/aggregate do processo e invariantes.
* Onde vive:

  * `domain/process.entity.ts`
  * `domain/process.types.ts`
  * `domain/process.validation.ts`
  * `domain/process.errors.ts`

#### C) `lifecycle`

* O que é: create/update/delete do processo.
* Onde vive:

  * `application/usecases/create-process.*`
  * `application/usecases/update-process.*`
  * `application/usecases/delete-process.*`

#### D) `association-containers`

* O que é: associar/desassociar containers ao processo, e “container-usecases” integrados.
* Onde vive:

  * `application/process.container-usecases.ts`
  * `application/usecases/remove-container-from-process.*`

#### E) `query`

* O que é: buscar/listar processos e readmodels.
* Onde vive:

  * `application/usecases/find-process-by-id.*`
  * `application/usecases/find-process-by-id-with-containers.*`
  * `application/usecases/list-processes.*`
  * `application/usecases/list-processes-with-containers.*`
  * `application/process.readmodels.ts`
  * `application/shipment.readmodel.ts`
  * `application/process.records.ts` (se são records de leitura)

#### F) `operational-projection`

* O que é: derive status e summary operacional agregada.
* Onde vive:

  * `application/projections/deriveProcessStatus.ts`
  * `application/projections/processOperationalSummary.ts`
  * `application/usecases/list-processes-with-operational-summary.*`
  * `application/process.presenter.ts` (se apresenta outputs operacionais)

#### G) `persistence`

* O que é: row + mapper + repository supabase.
* Onde vive:

  * `infrastructure/persistence/process.row.ts`
  * `infrastructure/persistence/process.persistence.mappers.ts`
  * `infrastructure/persistence/supabaseProcessRepository.ts`

#### H) `interface-http`

* O que é: controllers + schemas + http.mappers + bootstrap.
* Onde vive:

  * `interface/http/process.schemas.ts`
  * `interface/http/process.http.mappers.ts`
  * `interface/http/process.controllers.ts`
  * `interface/http/process.controllers.bootstrap.ts`

#### I) `ui-shipment-view`

* O que é: UI principal de shipment e componentes.
* Onde vive:

  * `ui/ShipmentView.tsx`
  * `ui/fetchProcess.ts`
  * `ui/components/*` (TimelinePanel, AlertsPanel, etc.)

#### J) `bootstrap`

* O que é: wiring do módulo.
* Onde vive:

  * `infrastructure/bootstrap/process.bootstrap.ts`

---

## 3) `tracking` — capabilities

### Visão

`tracking` é o motor event-driven: snapshots → observations → derivação (timeline/status/alerts) + fetchers/carriers.

### Capabilities propostas

#### A) `domain-model`

* O que é: tipos/records do tracking e contratos do domínio.
* Onde vive (proposta):

  * `domain/model/*`

    * provider, snapshot, observation, observationDraft, trackingAlert, timeline, containerStatus, observationType

#### B) `domain-derive`

* O que é: regras puras de derivação.
* Onde vive:

  * `domain/derive/*`

    * deriveTimeline, deriveStatus, deriveAlerts

#### C) `domain-reconcile`

* O que é: expected vs actual, séries, classificações e regras de “safe-first”.
* Onde vive:

  * `domain/reconcile/*`

    * expiredExpected, seriesClassification, reconcileForDisplay (separado)

#### D) `domain-identity`

* O que é: fingerprinting/idempotência.
* Onde vive:

  * `domain/identity/*`

    * fingerprint, alertFingerprint

#### E) `domain-logistics`

* O que é: regras logísticas específicas que são derivadas mas não centrais do motor.
* Onde vive:

  * `domain/logistics/transshipment.ts`

#### F) `orchestration-pipeline`

* O que é: orquestração de snapshot->observation->persist->derive.
* Onde vive:

  * `application/orchestration/*` (hoje `application/pipeline/*`)

    * pipeline, normalizeSnapshot, diffObservations

#### G) `projection`

* O que é: presenters/read-side (timeline/status/alerts) e resolvers de display.
* Onde vive:

  * `application/projection/*`

    * tracking.alert.presenter, tracking.status.presenter, tracking.timeline.presenter, locationDisplayResolver

#### H) `ports`

* O que é: contratos de repos.
* Onde vive:

  * `application/ports/*`

    * tracking.alert.repository, tracking.observation.repository, t
