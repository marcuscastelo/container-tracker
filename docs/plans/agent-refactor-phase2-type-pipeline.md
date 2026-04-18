# Agent Refactor Fase 2 — Type Pipeline (Canônico)

Data: 2026-04-14

## Pipeline oficial de fronteiras

1. **Config**
   - `RawAgentEnv -> ParsedAgentConfig -> ValidatedAgentConfig`
   - Owners: `config/*` + `core/contracts/agent-config.contract.ts`

2. **Sync job**
   - `BackendSyncJobDTO -> AgentSyncJob -> ProviderInput -> ProviderRunResult`
   - Owners: `sync/*` + `core/contracts/sync-job.contract.ts` + `core/contracts/provider.contract.ts`

3. **Backend result**
   - `ProviderRunResult -> BackendSyncAckDTO | BackendSyncFailureDTO`
   - Owner: `sync/sync-job.mapper.ts`

4. **State files**
   - `RawReleaseStateFile -> ReleaseState`
   - `RawRuntimeStateFile -> RuntimeState`
   - Owner: `state/*` + `core/contracts/release-state.contract.ts` + `core/contracts/runtime-state.contract.ts`

5. **Observability**
   - `runtime/internal -> HeartbeatPayload`
   - `runtime/internal -> HealthSnapshot`
   - Owner: `observability/*` + `core/contracts/observability.contract.ts`

## Regras ativas nesta fase

- Fronteira sempre muda tipo.
- DTO de sync é **estrito canônico** (sem wrappers `data/result` e sem camelCase legado).
- Parsing/validation só nas bordas; provider não valida estrutura global de job.
- Contratos centrais não usam `Partial<>`.
- Escrita atômica de estado local centralizada em `state/file-io.ts`.

## Ownership por camada (apps/agent)

- `core/contracts/*`: shape canônico de fronteira.
- `core/types/*`: enums/unions compartilhadas.
- `config/*`: parse/validate/serialize de config.
- `sync/*`: mappers de entrada/saída de jobs.
- `state/*`: parse/serialize de estado + I/ atômico.
- `observability/*`: payloads canônicos de heartbeat/health/log.
