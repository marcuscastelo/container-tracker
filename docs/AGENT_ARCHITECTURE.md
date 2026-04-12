<!-- AUTO-GENERATED: agent runtime audit (code-first). Do not edit unless you audit again. -->
# Agent architecture — code-first inventory (v2)

Data: 2026-03-09

Este documento substitui/atualiza `docs/AGENT_ARCHITECTURE.md` com um mapeamento exaustivo do *agent* conforme existente no código hoje. A fonte de verdade usada aqui é o código-fonte (import paths e trechos referenciados).

Sumário rápido
- Entrypoint runtime (agent): `tools/agent/agent.ts`
- Agent runtime (production-style) está em `tools/agent` e reutiliza módulos do monólito em `src/` (fetchers, realtime helpers, controllers).
- O servidor expõe os endpoints consumidos pelo agent:
  - `POST /api/agent/enroll` -> `src/modules/tracking/interface/http/agent-enroll.controllers.ts`
  - `GET /api/agent/targets` -> `src/routes/api/agent/targets.ts` -> `src/modules/tracking/interface/http/agent-sync.controllers.ts`
  - `POST /api/tracking/snapshots/ingest` -> `src/routes/api/tracking/snapshots/ingest.ts` -> `src/modules/tracking/interface/http/agent-sync.controllers.ts`
  - `POST /api/agent/heartbeat` -> `src/routes/api/agent/heartbeat.ts` -> `src/modules/agent/interface/http/agent-monitoring.controllers.ts`

---

## PARTE 1 — INVENTÁRIO DE ARQUIVOS E ENTRADAS

Organizei por temas (Runtime, Enrollment, Realtime, Queue/Lease, Fetchers, Ingest, Persistência, Observability, Tests). Cada item lista arquivos relevantes, papel e dependências observadas.

Runtime
- `tools/agent/agent.ts` — ENTRYPONT (core runtime). Função principal: bootstrap (enroll/config), scheduler, run loop, realtime subscription, heartbeat, scrape/ingest orchestration. (core)
  - Depende de: `tools/agent/agent.scheduler.ts`, `tools/agent/backoff.ts`, fetchers em `src/modules/tracking/infrastructure/carriers/fetchers/*`, `src/shared/supabase/*` (realtime helpers), `createMaerskCaptureService` (maersk puppeteer), and HTTP endpoints (backend).
  - Responsabilidades implementadas: parsing de dotenv/bootstrap, enrollment HTTP call, persistir `config.env`, scheduler start/stop, heartbeat send, fetch targets, process targets, ingest snapshots, subscribe realtime, SIGINT/SIGTERM handling.

- `tools/agent/agent.scheduler.ts` — scheduler/coalescer de runs (interval + realtime triggers). (core)
- `tools/agent/backoff.ts` — exponential backoff util (used by enrollment retry). (util)

Enrollment / Config bootstrap
- `tools/agent/agent.ts` (bootstrap logic):
  - `parseBootstrapConfigFromFile`, `enrollRuntime()` faz `POST /api/agent/enroll` (see line: enrollRuntime).
  - On success writes `config.env` and marks bootstrap consumed. Evidence: `enrollRuntime`, `persistConfigFile`, `consumeBootstrapFile` in `tools/agent/agent.ts`.

Server-side enrollment controller (adapter)
- `src/routes/api/agent/enroll.ts` -> `src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts` -> `src/modules/tracking/interface/http/agent-enroll.controllers.ts` (adapter + controller)
  - Responsibilities: validate installer token, create or update tracking_agents row, generate `agentToken`, persist enrollment audit, return runtime config (interval, limit, providers, supabase creds). Evidence: `createAgentEnrollControllers` functions and `enroll` implementation.

Realtime / Subscriptions (helpers)
- `src/shared/supabase/sync-requests.realtime.ts` — helper to subscribe to `sync_requests` changes (used by agent runtime)
- `src/shared/supabase/agent-monitoring.realtime.ts` — generic helpers for monitoring subscriptions (UI side)

Agent monitoring (monitoring/adapters)
- `src/modules/agent/infrastructure/bootstrap/agent.bootstrap.ts` — wiring to create `AgentMonitoringUseCases` using persistence implementation `supabaseAgentMonitoringRepository`.
- `src/modules/agent/infrastructure/persistence/supabaseAgentMonitoringRepository.ts` — repository adapter to Supabase tables `tracking_agents` and `tracking_agent_activity_events` (core adapter)
- `src/modules/agent/interface/http/agent-monitoring.controllers.ts` — HTTP controller that implements `POST /api/agent/heartbeat`, `GET /api/agents`, `GET /api/agents/:id`.

Queue / Leasing / Ingest (tracking side)
- `src/routes/api/agent/targets.ts` -> `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts` -> `src/modules/tracking/interface/http/agent-sync.controllers.ts`
  - `leaseSyncRequests` RPC invoked from `agent-sync.controllers.bootstrap` (see `supabaseServer.rpc('lease_sync_requests', ...)`). The RPC and table definitions live in `supabase/migrations/*.sql` (e.g. `supabase/migrations/2026022601_agent_runtime_enrolment.sql` and `20260309_02_agents_monitoring_operational_runtime.sql`).
  - `ingestSnapshot` in `agent-sync.controllers.ts` handles `POST /api/tracking/snapshots/ingest`, verifies lease, resolves container, calls `trackingUseCases.saveAndProcess`.

Fetchers / Provider integrations
- `src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts` — Maersk capture service (Puppeteer). Used by agent runtime via import in `tools/agent/agent.ts`.
- `src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts` — HTTP fetcher for MSC.
- `src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts` — HTTP fetcher for CMA-CGM.

Persistence / DB mapping
- `src/modules/agent/infrastructure/persistence/agent-monitoring.persistence.mappers.ts` — row <-> domain read model mappers.
- `src/modules/agent/infrastructure/persistence/agent-monitoring.row.ts` — typed DB row helpers (Database types).
- `supabase/migrations/*.sql` — DB schema for `tracking_agents`, `tracking_agent_activity_events`, `sync_requests`, indexes and constraints. Evidence: `supabase/migrations/2026022601_agent_runtime_enrolment.sql`, `20260309_02_agents_monitoring_operational_runtime.sql`.

Observability / logging / audit
- Enrollment audit: `agent_enrollment_audit_events` table via migrations and controller code in `agent-enroll.controllers.ts` (see `emitAuditEventSafely`).
- Agent activity: `tracking_agent_activity_events` table persisted by `AgentMonitoringUseCases.recordActivity` -> repository.insertActivityEvents (see `src/modules/agent/application/agent-monitoring.usecases.ts` and `supabaseAgentMonitoringRepository.insertActivityEvents`).
- Console logging present throughout `tools/agent/agent.ts` for lifecycle events and warnings.

Tests and scripts
- Agent runtime unit tests: `tools/agent/tests/*` (scheduler/backoff tests)
- HTTP adapter tests: `src/modules/tracking/interface/http/tests/*`, `src/routes/api/agent/tests/*` (agent endpoints)
- Scripts: `scripts/agent/*`, `tools/agent/build-release*` (build bundling and installer tasks). See `tools/agent/*`.

Small but decisive files (infra glue)
- `src/shared/supabase/unwrapSupabaseResult.ts` — unwrap helper used widely in persistence adapters.
- `src/shared/config/server-env.ts` — server env constants used by controllers.

---

## PARTE 2 — MAPA DE FUNCIONALIDADES REAIS

Vou listar as funcionalidades identificadas no código; para cada uma indico arquivos principais, entradas/saídas, side effects, persistência, estados e evidência direta (caminho). Se não existir, marco "não encontrada".

Funcionalidade: Bootstrap / Enrollment
- Objetivo: obter `AGENT_TOKEN` e runtime config a partir de `INSTALLER_TOKEN` (bootstrap) e gravar `config.env` localmente.
- Onde começa: `tools/agent/agent.ts` — `resolveRuntimeConfigWithBootstrap` -> `enrollRuntime`.
- Arquivos principais: `tools/agent/agent.ts` (bootstrap flow), `src/routes/api/agent/enroll.ts`, `src/modules/tracking/interface/http/agent-enroll.controllers.ts`.
- Inputs: `bootstrap.env` (INSTALLER_TOKEN, BACKEND_URL, AGENT_ID optional), network access to `${BACKEND_URL}/api/agent/enroll`.
- Outputs: local `config.env` (persisted runtime config via `persistConfigFile`), consumed bootstrap marker file `${bootstrap}.consumed`.
- Side effects: HTTP call to server, writes to disk, emits enrollment activity (server-side), may create `tracking_agents` DB row.
- Dependências: `fetch` to backend, `zod` schema validation, `writeFileAtomic` helper.
- Estados: bootstrap loop with exponential backoff (see `tools/agent/backoff.ts`).
- Persistência: local filesystem (config.env), server `tracking_agents` table.
- Evidence: `enrollRuntime` and `persistConfigFile` in `tools/agent/agent.ts`; server-side create/update in `src/modules/tracking/interface/http/agent-enroll.controllers.ts`.
- Observações: Retry/backoff implemented (`computeBackoffDelayMs`).

Funcionalidade: Runtime config parsing and validation
- Objetivo: carregar `config.env` e validar placeholder values.
- Onde: `tools/agent/agent.ts` functions `parseRuntimeConfigFromFile` and `detectRuntimePlaceholderKeys`.
- Inputs: file `${AGENT_DATA_DIR}/config.env`, environment overrides.
- Outputs: `RuntimeConfig` object used by the runtime.
- Evidence: `runtimeConfigSchema` (zod) and `parseRuntimeConfigFromFile`.

Funcionalidade: Heartbeat (agent -> server)
- Objetivo: periodicamente reportar estado do runtime e atividades para o servidor.
- Onde começa: `tools/agent/agent.ts` -> `sendHeartbeat` / `sendHeartbeatSafely`.
- Arquivos principais: `tools/agent/agent.ts` (client), `src/routes/api/agent/heartbeat.ts` -> `src/modules/agent/interface/http/agent-monitoring.controllers.ts` (server controller), `src/modules/agent/application/agent-monitoring.usecases.ts` (touchHeartbeat), `src/modules/agent/infrastructure/persistence/supabaseAgentMonitoringRepository.ts` (persistence updates).
- Inputs: runtime state object (realtimeState, processingState, leaseHealth, activeJobs, queueLagSeconds, lastError), activity events array.
- Outputs: HTTP POST to `/api/agent/heartbeat`, server persists runtime update (tracking_agents.update) and inserts activity events.
- Side effects: DB `tracking_agents` update, `tracking_agent_activity_events` inserts.
- Evidence: `sendHeartbeat` in `tools/agent/agent.ts` and `createAgentMonitoringControllers.heartbeat` -> `agentMonitoringUseCases.touchHeartbeat` -> `repository.updateAgentRuntimeState` + `insertActivityEvents`.

Funcionalidade: Polling / Scheduler run cycle
- Objetivo: periodicamente alugar (lease) e processar sync requests.
- Onde: `tools/agent/agent.ts` uses `createAgentScheduler` with `runCycle` delegating to `runOnce`.
- Arquivos principais: `tools/agent/agent.ts` (runLoop + runOnce), `tools/agent/agent.scheduler.ts` (coalescing + timer), `src/modules/tracking/interface/http/agent-sync.controllers.ts` (lease RPC call adapter via `agent-sync.controllers.bootstrap`), server `lease_sync_requests` RPC (in `supabase/migrations`).
- Inputs: `RuntimeConfig.LIMIT`, `GET /api/agent/targets` returns leased targets.
- Outputs: leased targets processed, heartbeat sent after cycle.
- Side effects: calls to fetchers, ingest snapshots, update runtime state, insert activity events.
- Evidence: `runOnce`, `fetchTargets`, `processTarget`, `ingestSnapshot` in `tools/agent/agent.ts`.

Funcionalidade: Realtime wake subscription
- Objetivo: acordar o agent imediatamente em novos `PENDING` sync_requests.
- Onde: `tools/agent/agent.ts` function `subscribeToRealtimeIfConfigured`.
- Arquivos: `tools/agent/agent.ts`, `src/shared/supabase/sync-requests.realtime.ts` (helper subscribe function). 
- Inputs: `SUPABASE_URL` & `SUPABASE_ANON_KEY` em runtime config.
- Outputs: `scheduler.triggerRun('realtime')` quando `INSERT/UPDATE` com `status=PENDING` é observado.
- Side effects: realtime client creation (supabase-js) and channel management.
- Evidence: `subscribeToRealtimeIfConfigured` calling `subscribeSyncRequestsByTenant`.

Funcionalidade: Lease acquisition and marking
- Objetivo: atomicamente lease sync requests (server-side) e depois marcar DONE/FAILED.
- Onde: client: `tools/agent/agent.ts` -> `fetchTargets` chama `GET /api/agent/targets` que aciona `lease_sync_requests` RPC no servidor via `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts`.
- Server-side marking: `markSyncRequestDone`, `markSyncRequestFailed` em `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts`.
- Persistence: `sync_requests` table, RPC `lease_sync_requests` (veja `supabase/migrations/*.sql`).

Funcionalidade: Provider scraping (fetchers)
- Objetivo: obter raw payload para provider/ref.
- Onde: `processTarget` -> `scrapeTarget` em `tools/agent/agent.ts`.
- Fetchers: `src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts`, `cmacgm.fetcher.ts`, `maersk.puppeteer.fetcher.ts`.
- Inputs: target (provider, ref), provider-specific configs (MAERSK_ENABLED, TIMEOUT, HEADLESS)
- Outputs: raw payload + observedAt timestamp
- Evidence: `scrapeTarget` uses fetcher imports at top of `tools/agent/agent.ts`.

Funcionalidade: Snapshot ingestion
- Objetivo: POST raw scrape payload to server snapshot ingest endpoint.
- Onde: `ingestSnapshot` em `tools/agent/agent.ts` posts to `/api/tracking/snapshots/ingest`.
- Server-side: `src/routes/api/tracking/snapshots/ingest.ts` -> `src/modules/tracking/interface/http/agent-sync.controllers.ts::ingestSnapshot`, which validates lease and calls `trackingUseCases.saveAndProcess` to persist and process snapshot.
- Outputs: on success returns 202 with `snapshot_id`; on conflict returns 409.

Funcionalidade: Lease conflict handling & retries
- Objetivo: detectar lease conflicts (409), marcar como conflito e continuar.
- Where: `ingestSnapshot` checks `response.status === 409` in `tools/agent/agent.ts` e retorna `{ kind: 'lease_conflict' }`.
- Server marks conflicts via `markSyncRequestFailed`/`markSyncRequestDone` em controllers.

Funcionalidade: Runtime state update on server
- Objetivo: server mantém `tracking_agents` row com métricas runtime.
- Where: múltiplos handlers chamam `agentMonitoringUseCases.updateRuntimeState` (ex: `agent-sync.controllers.ts::getTargets`, `agent-monitoring.controllers.ts::heartbeat`). Repositório: `supabaseAgentMonitoringRepository.updateAgentRuntimeState`.

Funcionalidade: Activity recording / audit trail
- Objetivo: persistir `tracking_agent_activity_events` rows para ENROLLED, HEARTBEAT, LEASED_TARGET, SNAPSHOT_INGESTED, REQUEST_FAILED, REALTIME_SUBSCRIBED, REALTIME_CHANNEL_ERROR, LEASE_CONFLICT.
- Onde: `agent-monitoring.usecases.recordActivity` e `agent-monitoring.persistence` insert rows; controllers chamam `recordAgentActivity`.

Funcionalidade: Signal handling & graceful shutdown
- Objetivo: em SIGINT/SIGTERM enviar heartbeat final, parar scheduler, unsubscribes realtime.
- Onde: `tools/agent/agent.ts` define `shutdown` e registra `process.once('SIGINT'/'SIGTERM', ...)`.

Funcionalidade: Local file layout and security
- Objetivo: data directory, config path, bootstrap path resolution e placeholder detection.
- Onde: `resolvePathLayout`, `resolveDefaultDataDir`, `serializeRuntimeConfig`, `detectRuntimePlaceholderKeys` em `tools/agent/agent.ts`.

Observações gerais sobre funcionalidades não encontradas
- Updater/restart/shutdown orchestrator (auto-updater) — NÃO encontrado no runtime atual. Há `tools/agent/updater.ts` mas sem integração no `agent.ts` run flow (não importado). Marcar: não confirmado.

---

## PARTE 3 — FLUXOS END-TO-END (passo a passo com arquivos)

1) Boot do agent (bootstrap or normal)
- Pré-condição: processo iniciado (node) e arquivo `config.env` ausente ou presente.
- Passos:
  1. `tools/agent/agent.ts::main()` chama `resolveRuntimeConfigWithBootstrap`.
  2. Se `config.env` válido -> retorna `RuntimeConfig` (parseRuntimeConfigFromFile).
  3. Se inválido/ausente -> tenta ler `bootstrap.env` via `parseBootstrapConfigFromFile`.
  4. Faz `POST ${BACKEND_URL}/api/agent/enroll` (`enrollRuntime`) e valida resposta (zod `enrollResponseSchema`).
  5. Persiste `config.env` via `persistConfigFile` e move `bootstrap.env` para `.consumed` via `consumeBootstrapFile`.
- Arquivos envolvidos: `tools/agent/agent.ts` (complete flow), server: `src/modules/tracking/interface/http/agent-enroll.controllers.ts`.
- Possíveis falhas: HTTP 4xx/5xx during enroll -> backoff and retry (`computeBackoffDelayMs`). Evidence: `catch` with backoff em `resolveRuntimeConfigWithBootstrap`.

2) Startup normal with config
- `main()` constrói `runtimeState`, chama `sendHeartbeatSafely` (initial heartbeat), configura scheduler e optional realtime subscription, então `scheduler.start()` (que dispara um immediate 'startup' run). Files: `tools/agent/agent.ts`, `tools/agent/agent.scheduler.ts`.

3) Polling periodic run
- Every `INTERVAL_SEC` scheduler triggers `runOnce`.
- `runOnce` calls `fetchTargets` (GET `/api/agent/targets`), process each leased target via `processTarget` -> `scrapeTarget` -> `ingestSnapshot`. Ao final do ciclo envia heartbeat. Files: `tools/agent/agent.ts` (runOnce, fetchTargets, processTarget, ingestSnapshot), server controllers `src/modules/tracking/interface/http/agent-sync.controllers.ts`.

4) Wake via realtime
- If Supabase realtime config present, `subscribeToRealtimeIfConfigured` uses `createClient` and `subscribeSyncRequestsByTenant` (`src/shared/supabase/sync-requests.realtime.ts`). On relevant events (INSERT/UPDATE where status === 'PENDING') call `scheduler.triggerRun('realtime')`.

5) Acquisition / lease of targets
- Agent GET /api/agent/targets -> server `lease_sync_requests` RPC returns rows. See `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts::leaseSyncRequests` which chama `supabaseServer.rpc('lease_sync_requests', {...})`.

6) Execution of a job (sync full cycle)
- For each leased target:
  1. `scrapeTarget` escolhe fetcher (msc/cmacgm/maersk) e retorna raw payload.
  2. `ingestSnapshot` POSTs para `/api/tracking/snapshots/ingest` com raw payload e metadata.
  3. Server `agent-sync.controllers.ingestSnapshot` valida lease, resolve container, chama `trackingUseCases.saveAndProcess`, marca sync_request DONE via `markSyncRequestDone` RPC.
  4. Agent atualiza runtime state e activity accordingly.

7) Heartbeat and runtime updates
- After each cycle (and at startup/shutdown/realtime state changes) `sendHeartbeatSafely` posts runtime metrics and aggregated recent activity to `/api/agent/heartbeat`. Server processes via `agent-monitoring.controllers.heartbeat` -> `agentMonitoringUseCases.touchHeartbeat` -> `updateAgentRuntimeState` and `insertActivityEvents`.

8) Error handling and retry
- Enrollment: exponential backoff com jitter (`tools/agent/backoff.ts`).
- Cycle errors: `scheduler.onRunError` sets `processingState='backing_off'`, sets `lastError`, envia heartbeat e registra `REQUEST_FAILED` activity. Evidence: `onRunError` em `tools/agent/agent.ts`.
- Ingest conflicts: HTTP 409 do servidor tratado como `lease_conflict` no agente; servidor marca conflito e registra activity.

9) Shutdown
- `process.once('SIGINT'/'SIGTERM')` -> `shutdown` envia final heartbeat, unsubscribes realtime, stops scheduler. Evidence: `tools/agent/agent.ts`.

---

## PARTE 4 — CONTRATOS E FRONTEIRAS (tipos, DTOs, headers, env)

Principais contratos (arquivo / produtor / consumidor / campos chave)

- Agent runtime config (zod) — `tools/agent/agent.ts::runtimeConfigSchema`
  - Producer: `POST /api/agent/enroll` (server) — see `agent-enroll.controllers.ts::toAgentEnrollResponse`
  - Consumer: `tools/agent/agent.ts::parseRuntimeConfigFromFile`
  - Campos: BACKEND_URL, SUPABASE_URL, SUPABASE_ANON_KEY, AGENT_TOKEN, TENANT_ID, AGENT_ID, INTERVAL_SEC, LIMIT, MAERSK_* configs.

- Enrollment request/response — server-side schemas: `src/modules/tracking/interface/http/agent-enroll.schemas.ts` and `agent-enroll.controllers.ts`

- Agent auth header: HTTP `Authorization: Bearer <AGENT_TOKEN>` usado por `agent-sync.controllers.ts::ensureAgentAuth` e `agent-monitoring.controllers.ts::heartbeat`.

- Agent identity header: `x-agent-id` (opcional) set by `tools/agent/agent.ts::buildHeaders`.

- GET /api/agent/targets response: `TargetsResponseSchema` defined/validated in `tools/agent/agent.ts` and server `agent-sync.controllers` `GetAgentTargetsResponseSchema` (see `src/modules/tracking/interface/http/agent-sync.schemas.ts`). Fields: targets array of { sync_request_id, provider, ref_type, ref }, leased_until, queue_lag_seconds.

- POST /api/tracking/snapshots/ingest body: `IngestSnapshotBodySchema` (server-side schema) — includes tenant_id, provider, ref {type,value}, observed_at, raw payload, meta, sync_request_id.

- POST /api/agent/heartbeat body/response: `AgentHeartbeatBodySchema` and `AgentHeartbeatResponseSchema` in `src/modules/agent/interface/http/agent-monitoring.schemas.ts`.

- DB contracts: `supabase/migrations/*.sql` definem `tracking_agents`, `tracking_agent_activity_events`, `sync_requests`. Types referenced por `src/shared/supabase/database.types.ts`.

Tensões arquiteturais observadas
- O runtime (tools/agent) importa diretamente módulos de `src/` (fetchers, realtime helpers, puppeteer capture). Isso é intencional (compartilhamento de lógica) e útil, mas cria acoplamento entre o worker e o monólito. Arquivos evidência:
  - `tools/agent/agent.ts` imports `../../src/modules/tracking/infrastructure/carriers/fetchers/...` and `../../src/shared/supabase/sync-requests.realtime.ts`.
- Observação: `tools/agent` usa Node runtime with direct ts imports and assumes developer build pipeline (see biome-ignore comments).

---

## PARTE 5 — DIVERGÊNCIA ENTRE DOCUMENTAÇÃO E CÓDIGO

Usei `docs/AGENT_ARCHITECTURE.md` como baseline e comparei com código. Abaixo tabelo as divergências encontradas.

| Tema                     | O que a documentação diz                     | O que o código atual mostra |                                                                                          Status | Arquivos-evidência                                | Comentário |
| ------------------------ | -------------------------------------------- | --------------------------: | ----------------------------------------------------------------------------------------------: | ------------------------------------------------- | ---------- |
| Entrypoint               | `tools/agent/agent.ts` como entrypoint       |                  CONFIRMADO |                                                                          `tools/agent/agent.ts` | confere                                           |
| Scheduler                | interval + realtime wake                     |                  CONFIRMADO |                                        `tools/agent/agent.scheduler.ts`, `tools/agent/agent.ts` | confere                                           |
| Enrollment               | bootstrap.env exchange to /api/agent/enroll  |                  CONFIRMADO |       `tools/agent/agent.ts`, `src/modules/tracking/interface/http/agent-enroll.controllers.ts` | confere                                           |
| Realtime                 | subscribes to `sync_requests` for `PENDING`  |                  CONFIRMADO |                         `tools/agent/agent.ts`, `src/shared/supabase/sync-requests.realtime.ts` | confere                                           |
| Updater/auto-restart     | doc mentions updater?                        |  NÃO CONFIRMADO (não ativo) |                                   `tools/agent/updater.ts` exists but not invoked by `agent.ts` | divergência — updater not wired in runtime        |
| Metrics/tracing pipeline | doc: limited metrics; earlier doc noted lack |                  CONFIRMADO | `tools/agent/agent.ts` logs only console, telemetry writes are best-effort (runTelemetrySafely) | no structured metrics/tracing pipeline discovered |

Conclusão: o documento principal está majoritariamente correto; divergência operacional importante: *updater* não está integrado automaticamente no `main()` (arquivo `tools/agent/updater.ts` não invocado). Também confirmar se políticas de armazenamento local de token/perm mitigadas conforme ops.

---

## PARTE 6 — ARTEFATO FINAL (relatório consolidado)

### 1. Executive Summary
O agente atual é um worker Node.js localizado em `tools/agent/agent.ts` que se auto-bootstrapa via `POST /api/agent/enroll`, executa um loop periódico (scheduler) para requisitar e processar targets (`GET /api/agent/targets`), executa fetchers provider-specific (`src/.../fetchers/*`), e envia snapshots para `POST /api/tracking/snapshots/ingest`. Mantém presença/telemetria via `POST /api/agent/heartbeat` e registra atividades em `tracking_agent_activity_events`. Realtime wake via Supabase é suportado. O runtime reutiliza código do monólito (fetchers e helpers) criando um acoplamento explícito (intencional).

### 2. Current Capability Map
- Bootstrap/enroll
- Parse & persist runtime config
- Scheduler with interval + realtime wake
- Lease acquisition (GET targets -> RPC `lease_sync_requests`)
- Provider scraping (Maersk/MSC/CMA-CGM)
- Snapshot ingestion and conflict handling
- Heartbeat & runtime state updates
- Activity/audit event persistence
- Graceful shutdown handling
- Unit tests for scheduler and backoff

### 3. File-by-File Responsibility Map (resumo)
| Arquivo                                                                             | Responsabilidade                                                                                              | Categoria                      | Funcionalidades relacionadas                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `tools/agent/agent.ts`                                                              | Entrypoint runtime: bootstrap, scheduler, run loop, realtime subscribe, heartbeat, fetch/ingest orchestration | runtime (core)                 | bootstrap, scheduler, polling, realtime, scrape, ingest, heartbeat, shutdown                      |
| `tools/agent/agent.scheduler.ts`                                                    | Scheduler (coalescing runs)                                                                                   | runtime util                   | scheduling, triggerRun, start/stop                                                                |
| `tools/agent/backoff.ts`                                                            | exponential backoff                                                                                           | util                           | enrollment retry                                                                                  |
| `tools/agent/tests/*`                                                               | unit tests (scheduler/backoff)                                                                                | tests                          | CI/unit evidence                                                                                  |
| `src/shared/supabase/sync-requests.realtime.ts`                                     | Realtime subscription helpers for `sync_requests` table                                                       | adapter                        | realtime filters/subscriptions used by agent runtime                                              |
| `src/modules/tracking/infrastructure/carriers/fetchers/*.ts`                        | Provider fetchers (msc, cmacgm, maersk puppeteer)                                                             | provider integrations          | scraping logic used by agent runtime                                                              |
| `src/routes/api/agent/targets.ts`                                                   | HTTP route adapter para agent targets                                                                         | route/adaptor                  | GET /api/agent/targets -> agent-sync controller                                                   |
| `src/modules/tracking/interface/http/agent-sync.controllers.ts`                     | Agent sync controllers: lease, ingestSnapshot                                                                 | controller/application-adapter | lease RPC, ingest snapshot, authorize agent token, update runtime state                           |
| `src/routes/api/tracking/snapshots/ingest.ts`                                       | route -> `agent-sync.controllers.ingestSnapshot`                                                              | route                          | snapshot ingest adapter                                                                           |
| `src/routes/api/agent/heartbeat.ts`                                                 | route -> `agent-monitoring.controllers.heartbeat`                                                             | route                          | heartbeat adapter                                                                                 |
| `src/modules/agent/interface/http/agent-monitoring.controllers.ts`                  | heartbeat/list/detail controllers                                                                             | controller                     | authenticate token, touchHeartbeat, recordActivity                                                |
| `src/modules/agent/infrastructure/persistence/supabaseAgentMonitoringRepository.ts` | repository adapter to Supabase/Postgres                                                                       | persistence                    | listAgents, getAgentDetail, authenticateAgentToken, updateAgentRuntimeState, insertActivityEvents |
| `supabase/migrations/*.sql`                                                         | DB schema, constraints, indices, RPC `lease_sync_requests`                                                    | infra SQL                      | `sync_requests`, `tracking_agents`, `tracking_agent_activity_events`                              |

### 4. End-to-End Runtime Map
Ver seção PARTE 3 (fluxos) — aqui, resumidamente: bootstrap -> persist config -> heartbeat -> scheduler.start -> runCycle: GET targets -> scrape -> POST ingest -> mark DONE -> send heartbeat -> repeat. Realtime triggers immediate run. Graceful shutdown sends final heartbeat e para scheduler.

### 5. External Integration Map
- Backend HTTP endpoints (same monolith): `/api/agent/enroll`, `/api/agent/targets`, `/api/tracking/snapshots/ingest`, `/api/agent/heartbeat` (files and controllers listed above).
- Supabase Realtime (optional): `SUPABASE_URL` + `SUPABASE_ANON_KEY` used to subscribe to `sync_requests` changes via `src/shared/supabase/sync-requests.realtime.ts`.
- Providers: Maersk (Puppeteer), MSC (HTTP), CMA-CGM (HTTP). Fetchers in `src/modules/tracking/infrastructure/carriers/fetchers`.
- Database / RPCs: `lease_sync_requests` RPC (see migrations), `sync_requests` table.

### 6. Operational State Model
- `startup` (bootstrap or config load) — confirmado (`main()` startup logic).
- `enrolled` — confirmado (server issues agent token at enroll).
- `idle` — no work returned from lease -> `processingState = 'idle'` (agent sets this).
- `leasing` — when attempting to lease targets (agent runOnce sets processingState).
- `processing` — while executing a target (activeJobs > 0).
- `backing_off` — on cycle error/backoff (scheduler.onRunError sets this).
- `realtime_subscribed` / `channel_error` / `disconnected` — realtime channel states set by subscription callbacks.
- `shutting_down` — SIGINT/SIGTERM handler sends final heartbeat and stops scheduler.

### 7. Confirmed vs Assumed
| Assunto                    |            Confirmado no código |                                                         Inferido |                                           Não confirmado |
| -------------------------- | ------------------------------: | ---------------------------------------------------------------: | -------------------------------------------------------: |
| Entrypoint                 |      X (`tools/agent/agent.ts`) |                                                                  |                                                          |
| Realtime subscribe         | X (`sync-requests.realtime.ts`) |                                                                  |                                                          |
| Auto-updater integration   |                                 |                                                                  | X (file exists `tools/agent/updater.ts` but not invoked) |
| Structured metrics/tracing |                                 | X (console logs + runTelemetrySafely used; no tracing lib found) |                                                          |

### 8. Documentation Drift
- Principal drift: `tools/agent/updater.ts` não é invocado pelo `agent.ts` (documentação sugeria pipelines de updater/installer). Status: divergiu parcialmente. Evidence: `tools/agent/updater.ts` exists but not imported in `agent.ts`.

### 9. Open Questions (pendências reais)
1. `tools/agent/updater.ts` — intenção operacional? não invocado; deveria o runtime iniciar o updater no background?
2. Política de armazenamento do `AGENT_TOKEN` (filesystem plaintext) — existe mitigação adicional (file perms)? não encontrado código que set permissões especiais ao gravar `config.env`.
3. Observability: existe pipeline de métricas/telemetria centralizada? Não encontrado (apenas logs e best-effort `runTelemetrySafely`).
4. Auto-scaling/coordenação: lease RPC usado; mas conflitos de ingest tratam via 409. Precisamos confirmar SLOs e requeue/backoff strategy (documentado parcialmente).

### 10. Suggested Next Doc (outline) — `AGENT_ARCHITECTURE_v2.md` (this file)
- Executive summary
- Runtime components & file map (with tree)
- Full E2E flows (bootstrap, run cycle, ingest, conflict handling)
- Contracts & schemas (enroll, targets, ingest, heartbeat)
- Operational runbook (how to start, bootstrap steps, env vars)
- Security notes & token storage
- Open questions & recommended checkpoints

---

## TL;DR para atualizar o ChatGPT
- O agent real é `tools/agent/agent.ts`. Ele faz bootstrap (POST /api/agent/enroll), executa um scheduler (interval + realtime), lease de targets (GET /api/agent/targets -> RPC `lease_sync_requests`), scrapes providers (`src/.../fetchers/*`), envia snapshots (`POST /api/tracking/snapshots/ingest`) e reporta runtime via `/api/agent/heartbeat`. Persiste presença e atividades em `tracking_agents` e `tracking_agent_activity_events`. Updater existe como arquivo mas não está integrado automaticamente — isso é uma divergência operacional importante.

---

Arquivo salvo: `docs/AGENT_ARCHITECTURE_v2.md`
