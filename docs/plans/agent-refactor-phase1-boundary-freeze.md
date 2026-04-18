# Agent Refactor Fase 1 — Boundary Freeze (ADR curto)

Status: **Accepted (Fase 1)**
Data: 2026-04-14
Escopo canônico: `apps/agent/src/**` sem `tests/**`

## Contexto

- agent atual já possui modularização parcial, mas ainda concentra decisões operacionais críticas em poucos hotspots.
- Fase 1 congela ownership e dependências para evitar refactor cego nas fases 2–6.
- Não há mudança comportamental nesta fase.

## Decisões

### 1) Raiz canônica e contexto legado

- raiz canônica do refactor é: **`apps/agent`**.
- Referências históricas de `tools/agent` permanecem como contexto/documentação legado.
- Novas decisões de arquitetura do agent devem apontar para `apps/agent`.

### 2) Árvore-alvo lógica congelada (contrato para Fases 2–6)

```text
apps/agent/src/
  app/
  core/
  config/
  release/
  runtime/
  sync/
  providers/
  state/
  observability/
  platform/
```

Ownership congelado:

- `app/`: composition root e entrypoints finos.
- `core/`: contratos/tipos/políticas puras (sem IO externo).
- `config/`: load/validate/resolve de configuração.
- `release/`: check/stage/activate/rollback.
- `runtime/`: lifecycle start/stop/restart/supervision.
- `sync/`: poll/lease/execute/ack/failure/retry de jobs.
- `providers/`: execução provider-specific.
- `state/`: leitura/escrita de estado local (arquivos de estado).
- `observability/`: logs/heartbeat/health/public snapshots operacionais.
- `platform/`: diferenças Linux/Windows (paths/process/extract/control).

### 3) Dependências proibidas (freeze)

- `providers/*` **não** conhece `release/*`.
- `release/*` **não** conhece lógica provider-specific.
- `runtime/*` **não** conhece shape detalhado de payload backend além de contratos explicitados em `core/*`/`sync/*`.
- `platform/*` é única camada que conhece diferenças -specific de comando/path/extract/process.
- `state/*` é owner exclusivo de persistência de arquivos de estado locais (sem escrita ad hoc em outras camadas).
- `app/*` compõe; não decide semântica operacional.

### 4) Fluxos permitidos (freeze)

- `app -> {runtime, release, config, sync, observability, platform, state, core}`
- `runtime -> {sync, providers, release, observability, state, config, platform, core}`
- `sync -> {providers, observability, state, core}`
- `release -> {state, platform, observability, core}`
- `observability -> {state, core}`
- `config -> {core, platform}`
- `platform -> core`
- `state -> core`
- `core -> (nenhuma camada acima)`

## Hotspots priorizados para Fase 2 (top 20%)

1. `apps/agent/src/runtime/runtime.entry.ts`
2. `apps/agent/src/supervisor/supervisor.entry.ts`
3. `apps/agent/src/control-core/agent-control-core.ts`
4. `apps/agent/src/control-core/local-control-service.ts`
5. `apps/agent/src/cli/ct-agent.ts`
6. `apps/agent/src/updater/updater.entry.ts`
7. `apps/agent/src/log-forwarder.ts`
8. `apps/agent/src/build-release.ts`

## APIs e compatibilidade

- Nenhuma API runtime/backend/UI foi alterada.
- Nenhum protocolo foi alterado.
- resultado da Fase 1 é exclusivamente contrato documental de ownership/boundaries.

## Guardrail da fase

- Sem mover arquivos de produção.
- Sem deduplicar comportamento nesta fase.
- Sem alterar fluxo de release/runtime/sync.
