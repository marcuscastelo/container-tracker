# Agent Refactor Fase 1 — Responsibility Matrix (`apps/agent`)

Data: 2026-04-14  
Escopo: `apps/agent/src/**` sem `tests/**`

## Matriz de capacidades (ownership atual -> ownership futuro congelado)

| Capacidade | Owner atual (código) | Owner futuro (freeze) | Duplicações por decisão operacional detectadas | Severidade da mistura | Evidências |
|---|---|---|---|---|---|
| config loading | `runtime/runtime.entry.ts`, `cli/ct-agent.ts`, `updater/updater.entry.ts`, `control-core/agent-control-core.ts` | `config/` | `D1`, `D2`, `D3` | alta | `runtime/runtime.entry.ts:74`, `cli/ct-agent.ts:131`, `updater/updater.entry.ts:72`, `control-core/agent-control-core.ts:92` |
| path resolution | `runtime/paths.ts`, `config/resolve-agent-paths.ts`, `runtime-paths.ts`, `config/resolve-agent-public-paths.ts` | `platform/` (resolução OS) + `config/` (layout canônico) | `D5` | alta | `runtime/paths.ts:54`, `config/resolve-agent-paths.ts:61`, `runtime-paths.ts:29`, `config/resolve-agent-public-paths.ts:21` |
| release state | `release-state.ts`, `release-manager.ts`, `runtime/runtime.entry.ts`, `supervisor/supervisor.entry.ts`, `updater/updater.entry.ts`, `control-core/local-control-service.ts` | `state/` (persistência) + `release/` (regras de transição) | `D7`, `D12` | alta | `release-state.ts:91`, `runtime/runtime.entry.ts:1715`, `updater/updater.entry.ts:367`, `supervisor/supervisor.entry.ts:546` |
| runtime start/stop | `supervisor/supervisor.entry.ts`, `platform/linux.adapter.ts`, `platform/windows.adapter.ts`, `platform/local-control.adapter.ts`, `control-core/local-control-service.ts` | `runtime/` | `D7` (drain/restart/activate acoplado ao release-state) | alta | `supervisor/supervisor.entry.ts:413`, `platform/linux.adapter.ts:61`, `platform/windows.adapter.ts:77`, `control-core/local-control-service.ts:421` |
| health | `runtime/runtime.entry.ts`, `runtime-health.ts`, `supervisor/supervisor.entry.ts`, `control-core/public-control-files.ts` | `observability/` | `D4`, `D10` | média | `runtime/runtime.entry.ts:1068`, `runtime-health.ts:54`, `supervisor/supervisor.entry.ts:345`, `control-core/public-control-files.ts:124` |
| polling | `runtime/runtime.entry.ts`, `agent.scheduler.ts` | `sync/` | `D12` (fluxo de update/poll no runtime monolítico) | média | `agent.scheduler.ts:73`, `runtime/runtime.entry.ts:1343` |
| provider dispatch | `runtime/runtime.entry.ts` (dispatch), fetchers em `src/modules/tracking/.../fetchers/*` | `providers/` | `D12` (orquestração sync/update centralizada no runtime) | alta | `runtime/runtime.entry.ts:1132` |
| job ack/failure | `runtime/runtime.entry.ts`, backend via `/api/agent/targets` e `/api/tracking/snapshots/ingest` | `sync/` | `D7`, `D12` | alta | `runtime/runtime.entry.ts:1200`, `runtime/runtime.entry.ts:1259`, `runtime/runtime.entry.ts:1305` |
| log append | `log-forwarder.ts`, `supervisor/supervisor.entry.ts`, `updater/updater.entry.ts`, `control-core/public-control-files.ts`, `control-core/local-control-service.ts` | `observability/` | `D8`, `D9`, `D10` | alta | `log-forwarder.ts:402`, `supervisor/supervisor.entry.ts:192`, `updater/updater.entry.ts:199`, `control-core/public-control-files.ts:60` |
| OS adaptation | `platform/*.ts`, `electron/main/installed-linux-control-service.ts`, scripts `installer/*.ps1` | `platform/` | `D5`, `D11` | média | `platform/local-control.adapter.ts:172`, `platform/windows.adapter.ts:29`, `electron/main/installed-linux-control-service.ts:116` |

## Notas de congelamento

- Cada linha da matriz tem owner futuro definido e explícito (sem ownership ambíguo por capacidade).
- O owner futuro é contrato de Fase 1; movimentação física de arquivo fica para fases seguintes.
- A lista de duplicações detalhada e rastreável por linha está em: `docs/plans/agent-refactor-phase1-operational-duplications.md`.
