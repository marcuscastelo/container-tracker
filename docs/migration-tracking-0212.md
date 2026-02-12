# Tracking — Migração Arquitetural (repo + usecases)

Base: `#docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md`

## 0) Diagnóstico objetivo (violações / cheiros)

### A. `supabaseObservationRepository.ts`

1. **Infra importando schema do domínio (`ObservationSchema`) e parseando Row → `Observation`.**

   * **Por quê é problema:** domínio não pode depender de Zod como “modelo canônico”; e infra não deve conhecer/produzir `Entity` diretamente (fronteira muda o tipo).

2. **Repo retorna `Observation` (domínio) e faz “skip” silencioso com `console.error`.**

   * **Por quê é problema:** repository deve ser determinístico e confiável; erro de mapping é erro de infraestrutura (deve **lançar**) e não retornar dados parciais.

3. **Mapper local dentro do arquivo do repository.**

   * **Por quê é problema:** mappers devem ficar **centralizados** em `infrastructure/persistence/*Mapper.ts` (padrão dos módulos `container`/`process`).

4. **Union `{ success: true/false }` interna e tolerância a dados inválidos.**

   * **Por quê é problema:** o padrão do projeto é `throw` + erros estruturados; unions “success” reaparecem por tabela.

### B. `application/trackingUseCases.ts`

1. **UseCases retornando “summary” que parece ViewModel (`ContainerTrackingSummary`) dentro de application.**

   * **Por quê é problema:** ViewModel é frontend-only; application deve retornar **Result DTO** (contrato de fronteira), não estrutura “pronta pra UI” misturada ao domínio.

2. **`createTrackingUseCases` define funções sem `Command/Result` por caso de uso.**

   * **Por quê é problema:** padrão exige 1 arquivo por use case, com `Command`/`Result` tipados e `facade` só compondo.

3. **Erros de fetch são persistidos como snapshot com payload `_error` e parse_error, e pipeline roda.**

   * **Nota:** isso pode continuar (é bom pra auditoria), mas o **contrato de retorno** deve ser `Result` explícito (ex.: `kind: 'ok' | 'no_fetcher' | 'fetch_failed'`).

---

## 1) Objetivo da etapa (menor diff, `pnpm type-check` verde)

**Etapa 1:** alinhar **infra/persistence** do tracking ao padrão `Row/InsertRow/UpdateRow + Mapper`, e fazer repo **lançar** em caso de dados inválidos.

* Não mexer em pipeline/derivations agora.
* Não mexer em fetchers agora.

---

## 2) Mudanças propostas — Etapa 1 (infra/persistence)

### 2.1 Criar mappers centralizados

Criar:

* `src/modules/tracking/infrastructure/persistence/observationMapper.ts`

Conteúdo sugerido:

```ts
import type { Observation } from '~/modules/tracking/domain/observation'
import type { Tables, TablesInsert } from '~/shared/supabase/database.types'
import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

export type ObservationRow = Tables<'container_observations'>
export type ObservationInsertRow = TablesInsert<'container_observations'>

// IMPORTANTE: sem Zod aqui. Mapper é conversão determinística de tipos confiáveis.
// Se precisar validar unknown -> VO, isso acontece antes (controller/usecase) ou num VO factory.

export function rowToObservation(row: ObservationRow): Observation {
  // Aqui assumimos que o banco está consistente. Se quiser robustez, valide invariantes simples e throw.
  // Ex.: container_id obrigatório, provider string, etc.

  return {
    id: row.id,
    fingerprint: row.fingerprint,
    container_id: row.container_id,
    container_number: row.container_number,
    event_time_type: row.event_time_type,
    type: row.type,
    event_time: normalizeTimestamptz(row.event_time),
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: row.confidence,
    provider: row.provider,
    created_from_snapshot_id: row.created_from_snapshot_id,
    created_at: normalizeTimestamptz(row.created_at),
    retroactive: row.retroactive,
  }
}

export function newObservationToInsertRow(obs: {
  readonly fingerprint: string
  readonly container_id: string
  readonly container_number: string
  readonly type: string
  readonly event_time: string | null
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly is_empty: boolean | null
  readonly confidence: string
  readonly provider: string
  readonly created_from_snapshot_id: string
  readonly retroactive?: boolean | null
  readonly event_time_type: string
}): ObservationInsertRow {
  return {
    fingerprint: obs.fingerprint,
    container_id: obs.container_id,
    container_number: obs.container_number,
    type: obs.type,
    event_time: obs.event_time == null ? null : normalizeTimestamptz(obs.event_time),
    location_code: obs.location_code,
    location_display: obs.location_display,
    vessel_name: obs.vessel_name,
    voyage: obs.voyage,
    is_empty: obs.is_empty,
    confidence: obs.confidence,
    provider: obs.provider,
    created_from_snapshot_id: obs.created_from_snapshot_id,
    retroactive: obs.retroactive ?? false,
    event_time_type: obs.event_time_type,
  }
}
```

**Razão (1–2 frases):** centraliza conversões em infra, e remove Zod como “modelo de domínio” no caminho infra→domain.

> Observação: aqui eu mantive o tipo de `Observation` como está hoje (domínio). Na Etapa 2 a gente decide se `Observation` continuará sendo “domain record” ou vira `ObservationEntity` backend-only.

### 2.2 Refatorar `supabaseObservationRepository.ts` para usar mapper e lançar

Trocar para:

```ts
import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import type { ObservationRepository } from '~/modules/tracking/domain/observationRepository'
import { supabase } from '~/shared/supabase/supabase'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'
import {
  type ObservationRow,
  newObservationToInsertRow,
  rowToObservation,
} from '~/modules/tracking/infrastructure/persistence/observationMapper'

const TABLE = 'container_observations' as const

export const supabaseObservationRepository: ObservationRepository = {
  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    if (observations.length === 0) return []

    const rows = observations.map((obs) => newObservationToInsertRow(obs))

    const result = await supabase.from(TABLE).insert(rows).select('*')
    const data = unwrapSupabaseResultOrThrow(result, { operation: 'insertMany', table: TABLE })

    // Falha de mapping aqui deve quebrar: dados corrompidos ou schema drift.
    return (data ?? []).map((row) => rowToObservation(row as ObservationRow))
  },

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('event_time', { ascending: true, nullsFirst: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findAllByContainerId',
      table: TABLE,
    })

    return (data ?? []).map((row) => rowToObservation(row as ObservationRow))
  },

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const result = await supabase.from(TABLE).select('fingerprint').eq('container_id', containerId)
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findFingerprintsByContainerId',
      table: TABLE,
    })

    const fingerprints = new Set<string>()
    for (const row of data ?? []) {
      if (row && typeof row.fingerprint === 'string') fingerprints.add(row.fingerprint)
    }
    return fingerprints
  },
}
```

**Razão (1–2 frases):** repository não devolve “parcial” nem mascara inconsistência; infra converte via mapper centralizado e lança em caso de drift.

> Se você quiser manter robustez sem quebrar produção, dá pra lançar com mensagem rica e um `cause` com `row.id` e `container_id`.

### 2.3 Remover dependência de Zod no caminho infra

* Remover imports `ObservationSchema` e `formatParseError` do repository.

**Razão:** Zod fica para *parsing de unknown em fronteiras* (ex.: controller DTO → Command) e/ou factories de Value Objects.

---

## 3) Etapa 2 (application/usecases) — plano, sem executar ainda

### Problema atual

`createTrackingUseCases` mistura:

* *use cases* (fetch/save/process)
* *query* (getContainerSummary)
* *apresentação* (summary “pronto”)

### Alvo

1 arquivo por use case (mínimo):

* `application/usecases/fetchAndProcess.ts`
* `application/usecases/saveAndProcess.ts`
* `application/usecases/getContainerSummary.ts`
* `application/usecases/acknowledgeAlert.ts`
* `application/usecases/dismissAlert.ts`
* `application/usecases/getSnapshotsForContainer.ts`
* `application/usecases/getLatestSnapshot.ts`

Cada um com:

* `type Command = { ... }`
* `type Result = { ... }`
* `export async function <name>(deps, command): Promise<Result>`

E `application/trackingUseCases.ts` vira **facade** que só compõe.

**Razão (1–2 frases):** padroniza contratos e isola mudanças; controllers viram adapters DTO→Command e Result→DTO.

### Ajuste chave: `getContainerSummary`

* Hoje retorna `ContainerTrackingSummary` que é “quase ViewModel”.
* Proposta: retornar `Result DTO` explícito, e presenters (se existirem) migram para frontend (ou para interface/http DTO mappers).

---

## 4) Checklist de aceitação (Etapa 1)

* [ ] `supabaseObservationRepository.ts` não importa Zod nem schemas do domínio.
* [ ] mapper em `infrastructure/persistence/observationMapper.ts` existe e é usado.
* [ ] nenhum `console.error` para “pular row inválida” no repo.
* [ ] `pnpm type-check` passa.
* [ ] testes de tracking continuam passando (pelo menos unit).

---

## 5) Próximo arquivo que eu quero ver (para Etapa 1 completar)

1. `src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts`
2. `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts`

Eu vou repetir o mesmo padrão: Row/InsertRow/UpdateRow + mapper centralizado + throw.

---

# Etapa 2 — Application (use cases + facade) — execução incremental (menor diff)

Objetivo: substituir `application/trackingUseCases.ts` (factory monolítica) por:

* `application/usecases/*` (1 arquivo por caso de uso)
* `application/trackingUseCases.ts` como **facade** (somente composição + DI)

## 2.0 Regras (do guia)

* Application expõe **Command/Result** por use case.
* Controllers (quando existirem) fazem DTO → Command e Result → Response DTO.
* Domain continua sendo usado internamente (deriveTimeline/deriveStatus etc), mas o **retorno** deve ser Result (contrato), não ViewModel.

---

## 2.1 Layout final de arquivos

Criar pasta:

* `src/modules/tracking/application/usecases/`

Criar arquivos:

* `fetchAndProcess.ts`
* `saveAndProcess.ts`
* `getContainerSummary.ts`
* `acknowledgeAlert.ts`
* `dismissAlert.ts`
* `getSnapshotsForContainer.ts`
* `getLatestSnapshot.ts`

E manter (refatorar) o facade:

* `src/modules/tracking/application/trackingUseCases.ts`

---

## 2.2 Tipos compartilhados (deps)

Criar (ou manter no facade) o tipo de deps **application-only**:

```ts
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshotRepository'
import type { ObservationRepository } from '~/modules/tracking/domain/observationRepository'
import type { TrackingAlertRepository } from '~/modules/tracking/domain/trackingAlertRepository'

export type TrackingUseCasesDeps = {
  readonly snapshotRepository: SnapshotRepository
  readonly observationRepository: ObservationRepository
  readonly trackingAlertRepository: TrackingAlertRepository
}
```

Razão (1–2 frases): deps explícitas evitam import circular e padronizam DI; o resto é puro.

---

## 2.3 Use case: fetchAndProcess

### Command/Result

```ts
import type { Provider } from '~/modules/tracking/domain/provider'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import type { PipelineResult } from '~/modules/tracking/application/pipeline'

export type FetchAndProcessCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: Provider
}

export type FetchAndProcessResult =
  | { readonly kind: 'no_fetcher' }
  | { readonly kind: 'ok'; readonly snapshot: Snapshot; readonly pipeline: PipelineResult }
  | {
      readonly kind: 'fetch_failed'
      readonly snapshot: Snapshot
      readonly pipeline: PipelineResult
      readonly errorMessage: string
    }
```

### Implementação

```ts
import { processSnapshot, type PipelineResult } from '~/modules/tracking/application/pipeline'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { getRestFetcher } from '~/modules/tracking/infrastructure/fetchers/restFetchers'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'

export async function fetchAndProcess(
  deps: TrackingUseCasesDeps,
  cmd: {
    readonly containerId: string
    readonly containerNumber: string
    readonly provider: Provider
  },
): Promise<
  | { readonly kind: 'no_fetcher' }
  | { readonly kind: 'ok'; readonly snapshot: Snapshot; readonly pipeline: PipelineResult }
  | {
      readonly kind: 'fetch_failed'
      readonly snapshot: Snapshot
      readonly pipeline: PipelineResult
      readonly errorMessage: string
    }
> {
  const { snapshotRepository, observationRepository, trackingAlertRepository } = deps
  const pipelineDeps = { snapshotRepository, observationRepository, trackingAlertRepository }

  const fetcher = getRestFetcher(cmd.provider)
  if (!fetcher) return { kind: 'no_fetcher' }

  let fetchResult: FetchResult
  try {
    fetchResult = await fetcher(cmd.containerNumber)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorSnapshot: NewSnapshot = {
      container_id: cmd.containerId,
      provider: cmd.provider,
      fetched_at: new Date().toISOString(),
      payload: { _error: true, message: errorMessage },
      parse_error: `Fetch failed: ${errorMessage}`,
    }
    const snapshot = await snapshotRepository.insert(errorSnapshot)
    const pipeline = await processSnapshot(snapshot, cmd.containerId, cmd.containerNumber, pipelineDeps, false)
    return { kind: 'fetch_failed', snapshot, pipeline, errorMessage }
  }

  const newSnapshot: NewSnapshot = {
    container_id: cmd.containerId,
    provider: fetchResult.provider,
    fetched_at: fetchResult.fetchedAt,
    payload: fetchResult.payload,
    parse_error: null,
  }

  const snapshot = await snapshotRepository.insert(newSnapshot)
  const pipeline = await processSnapshot(snapshot, cmd.containerId, cmd.containerNumber, pipelineDeps, false)
  return { kind: 'ok', snapshot, pipeline }
}
```

Razão (1–2 frases): `kind` remove `null` ambíguo e deixa erro/auditoria explícitos.

---

## 2.4 Use case: saveAndProcess

```ts
import { processSnapshot, type PipelineResult } from '~/modules/tracking/application/pipeline'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type SaveAndProcessCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: Provider
  readonly payload: unknown
  readonly parseError?: string | null
}

export type SaveAndProcessResult = {
  readonly snapshot: Snapshot
  readonly pipeline: PipelineResult
}

export async function saveAndProcess(
  deps: TrackingUseCasesDeps,
  cmd: SaveAndProcessCommand,
): Promise<SaveAndProcessResult> {
  const { snapshotRepository, observationRepository, trackingAlertRepository } = deps
  const pipelineDeps = { snapshotRepository, observationRepository, trackingAlertRepository }

  const newSnapshot: NewSnapshot = {
    container_id: cmd.containerId,
    provider: cmd.provider,
    fetched_at: new Date().toISOString(),
    payload: cmd.payload,
    parse_error: cmd.parseError ?? null,
  }

  const snapshot = await snapshotRepository.insert(newSnapshot)
  const pipeline = await processSnapshot(snapshot, cmd.containerId, cmd.containerNumber, pipelineDeps, false)
  return { snapshot, pipeline }
}
```

Razão (1–2 frases): separa claramente “persistir snapshot” de “processar”, com contrato simples.

---

## 2.5 Use case: getContainerSummary (Result DTO, não ViewModel)

Problema atual: `ContainerTrackingSummary` parece ViewModel.

Proposta mínima (sem quebrar UI ainda):

* `Result` continua retornando timeline/status/transshipment/alerts (dados derivados),
* mas formalizado como `Result` (contrato) e sem presenters aqui.

```ts
import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import { deriveTransshipment } from '~/modules/tracking/domain/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/deriveTimeline'
import type { Observation } from '~/modules/tracking/domain/observation'
import type { Timeline } from '~/modules/tracking/domain/timeline'
import type { TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import type { TransshipmentInfo } from '~/modules/tracking/domain/transshipment'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type GetContainerSummaryCommand = {
  readonly containerId: string
  readonly containerNumber: string
}

export type GetContainerSummaryResult = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly alerts: readonly TrackingAlert[]
}

export async function getContainerSummary(
  deps: TrackingUseCasesDeps,
  cmd: GetContainerSummaryCommand,
): Promise<GetContainerSummaryResult> {
  const [observations, alerts] = await Promise.all([
    deps.observationRepository.findAllByContainerId(cmd.containerId),
    deps.trackingAlertRepository.findActiveByContainerId(cmd.containerId),
  ])

  const timeline = deriveTimeline(cmd.containerId, cmd.containerNumber, observations)
  const status = deriveStatus(timeline)
  const transshipment = deriveTransshipment(timeline)

  return {
    containerId: cmd.containerId,
    containerNumber: cmd.containerNumber,
    observations,
    timeline,
    status,
    transshipment,
    alerts,
  }
}
```

Razão (1–2 frases): mantém o mesmo shape atual, mas agora é um **Result** formal (fronteira), e presenters saem daqui depois.

---

## 2.6 Use cases pequenos (alerts + snapshots)

### acknowledgeAlert

```ts
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type AcknowledgeAlertCommand = { readonly alertId: string; readonly ackedAt: string }
export type AcknowledgeAlertResult = void

export async function acknowledgeAlert(
  deps: TrackingUseCasesDeps,
  cmd: AcknowledgeAlertCommand,
): Promise<void> {
  await deps.trackingAlertRepository.acknowledge(cmd.alertId, cmd.ackedAt)
}
```

### dismissAlert

```ts
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type DismissAlertCommand = { readonly alertId: string; readonly dismissedAt: string }
export type DismissAlertResult = void

export async function dismissAlert(
  deps: TrackingUseCasesDeps,
  cmd: DismissAlertCommand,
): Promise<void> {
  await deps.trackingAlertRepository.dismiss(cmd.alertId, cmd.dismissedAt)
}
```

### getSnapshotsForContainer

```ts
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type GetSnapshotsForContainerCommand = { readonly containerId: string }
export type GetSnapshotsForContainerResult = readonly Snapshot[]

export async function getSnapshotsForContainer(
  deps: TrackingUseCasesDeps,
  cmd: GetSnapshotsForContainerCommand,
): Promise<readonly Snapshot[]> {
  return await deps.snapshotRepository.findAllByContainerId(cmd.containerId)
}
```

### getLatestSnapshot

```ts
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type GetLatestSnapshotCommand = { readonly containerId: string }
export type GetLatestSnapshotResult = Snapshot | null

export async function getLatestSnapshot(
  deps: TrackingUseCasesDeps,
  cmd: GetLatestSnapshotCommand,
): Promise<Snapshot | null> {
  return await deps.snapshotRepository.findLatestByContainerId(cmd.containerId)
}
```

---

## 2.7 Refatorar `application/trackingUseCases.ts` para facade

Novo comportamento:

* o facade **não implementa lógica**;
* só injeta deps e expõe funções que chamam os use cases.

```ts
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { fetchAndProcess } from '~/modules/tracking/application/usecases/fetchAndProcess'
import { saveAndProcess } from '~/modules/tracking/application/usecases/saveAndProcess'
import { getContainerSummary } from '~/modules/tracking/application/usecases/getContainerSummary'
import { acknowledgeAlert } from '~/modules/tracking/application/usecases/acknowledgeAlert'
import { dismissAlert } from '~/modules/tracking/application/usecases/dismissAlert'
import { getSnapshotsForContainer } from '~/modules/tracking/application/usecases/getSnapshotsForContainer'
import { getLatestSnapshot } from '~/modules/tracking/application/usecases/getLatestSnapshot'

export function createTrackingUseCases(deps: TrackingUseCasesDeps) {
  return {
    fetchAndProcess: (containerId: string, containerNumber: string, provider: any) =>
      fetchAndProcess(deps, { containerId, containerNumber, provider }),

    saveAndProcess: (containerId: string, containerNumber: string, provider: any, payload: unknown, parseError: string | null = null) =>
      saveAndProcess(deps, { containerId, containerNumber, provider, payload, parseError }),

    getContainerSummary: (containerId: string, containerNumber: string) =>
      getContainerSummary(deps, { containerId, containerNumber }),

    acknowledgeAlert: (alertId: string) =>
      acknowledgeAlert(deps, { alertId, ackedAt: new Date().toISOString() }),

    dismissAlert: (alertId: string) =>
      dismissAlert(deps, { alertId, dismissedAt: new Date().toISOString() }),

    getSnapshotsForContainer: (containerId: string) =>
      getSnapshotsForContainer(deps, { containerId }),

    getLatestSnapshot: (containerId: string) =>
      getLatestSnapshot(deps, { containerId }),
  }
}

export type TrackingUseCases = ReturnType<typeof createTrackingUseCases>
```

Nota: aqui eu mantive a **API pública do facade** parecida com a de hoje (menor diff). Depois, controllers podem chamar direto os use cases com Command.

---

## 2.8 Checklist de aceitação (Etapa 2)

* [ ] `application/usecases/*` existe e cada arquivo exporta `Command`/`Result`.
* [ ] `application/trackingUseCases.ts` virou facade (sem lógica de negócio).
* [ ] Não há mais `ContainerTrackingSummary` “ad-hoc”; `getContainerSummary` retorna `Result` tipado.
* [ ] `pnpm type-check` passa.
* [ ] Testes do tracking passam.
