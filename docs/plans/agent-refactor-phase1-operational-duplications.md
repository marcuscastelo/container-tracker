# Agent Refactor Fase 1 — Operational Duplications (`apps/agent`)

Data: 2026-04-14  
Escopo: `apps/agent/src/**` sem `tests/**`  
Critério: registrar apenas **decisão operacional repetida** (não apenas função parecida).

## Duplicações reais detectadas

| ID | Decisão operacional repetida | Evidências (mín. 2) | Impacto | Severidade | Owner futuro |
|---|---|---|---|---|---|
| D1 | Parsing de `.env` com mesma semântica (`unquoteValue` + `parseEnvLine`) | `runtime/runtime.entry.ts:61`, `runtime/runtime.entry.ts:74`; `cli/ct-agent.ts:118`, `cli/ct-agent.ts:131`; `updater/updater.entry.ts:59`, `updater/updater.entry.ts:72`; `control-core/agent-control-core.ts:74`, `control-core/agent-control-core.ts:92` | drift de parsing entre runtime/CLI/updater/control | alta | `config/` |
| D2 | Regra de placeholders inválidos para enrollment/config runtime | `runtime/runtime.entry.ts:350`, `runtime/runtime.entry.ts:358`, `runtime/runtime.entry.ts:364`; `cli/ct-agent.ts:171`, `cli/ct-agent.ts:179`, `cli/ct-agent.ts:185` | inconsistência de validação bootstrap/runtime entre fluxos | alta | `config/` |
| D3 | Serialização de `config.env` (incl. `AGENT_UPDATE_MANIFEST_CHANNEL`) | `runtime/runtime.entry.ts:580`; `cli/ct-agent.ts:377`; `control-core/agent-control-core.ts:184` | risco de divergência de shape de config persistida | alta | `config/` |
| D4 | Escrita atômica de arquivo (`.tmp` + `rename`) replicada em múltiplos módulos | `runtime/runtime.entry.ts:623`; `cli/ct-agent.ts:421`; `release-state.ts:36`; `runtime-health.ts:45`; `pending-activity.ts:44`; `supervisor-control.ts:14`; `control-core/public-control-files.ts:34`; `control-core/public-control-state.ts:19` | manutenção difícil e sem owner único de política de persistência | alta | `state/` |
| D5 | Decisão de layout local (`DATA_DIR/current/previous/releases`, paths públicos, `DOTENV_PATH`) | `runtime/paths.ts:54`, `runtime/paths.ts:71`, `runtime/paths.ts:125`; `config/resolve-agent-paths.ts:61`, `config/resolve-agent-paths.ts:85`; `runtime-paths.ts:29`; `config/resolve-agent-public-paths.ts:21`; `updater.ts:17` | comportamento de path pode divergir por entrypoint e wrapper | alta | `platform/` + `config/` |
| D6 | Política de update check disable (`AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS` vs channel) | `update-checks.ts:28`, `update-checks.ts:31`; `runtime/runtime.entry.ts:1781`, `runtime/runtime.entry.ts:1793`; `supervisor/supervisor.entry.ts:499`, `supervisor/supervisor.entry.ts:506` | regra operacional duplicada em runtime/supervisor | média | `release/` |
| D7 | Mutação de `release-state` para update/activation (`target_version`, `activation_state`, rollback) | `runtime/runtime.entry.ts:1661`, `runtime/runtime.entry.ts:1715`; `updater/updater.entry.ts:367`, `updater/updater.entry.ts:373`; `supervisor/supervisor.entry.ts:546`, `supervisor/supervisor.entry.ts:754`; `control-core/local-control-service.ts:539`, `control-core/local-control-service.ts:579` | múltiplos writers para mesma verdade operacional | alta | `release/` + `state/` |
| D8 | Fila local de atividade operacional (append/drain) compartilhada e distribuída | `pending-activity.ts:71`, `pending-activity.ts:84`; `runtime/runtime.entry.ts:37`, `runtime/runtime.entry.ts:1827`; `supervisor/supervisor.entry.ts:13`, `supervisor/supervisor.entry.ts:559`; `updater/updater.entry.ts:10`, `updater/updater.entry.ts:279`; `control-core/agent-control-core.ts:16`, `control-core/agent-control-core.ts:330` | sem boundary único de eventos locais de operação | média | `observability/` + `state/` |
| D9 | Política de leitura/tail de logs (bounds e canais) em mais de um owner | `control-core/public-control-files.ts:60`, `control-core/public-control-files.ts:209`; `control-core/local-control-service.ts:332`, `control-core/local-control-service.ts:357`; `cli/ct-agent.ts:546`; `log-forwarder.ts:402` | UX e semântica de logs podem divergir por interface | alta | `observability/` |
| D10 | Publicação de snapshot/backend-state público em caminhos de runtime | `control-core/public-control-files.ts:124`; `control-core/public-control-state.ts:73`; `supervisor/supervisor.entry.ts:84`, `supervisor/supervisor.entry.ts:108`; `runtime/runtime.entry.ts:313` | duplicação de gatilhos de publicação e refresh | média | `state/` + `observability/` |
| D11 | Boot updater via wrappers (`ensure DOTENV_PATH` + start updater) | `updater.ts:12`, `updater.ts:17`; `bootstrap/updater-entry.ts:8`, `bootstrap/updater-entry.ts:13` | manutenção dupla para mesma decisão de entry | média | `app/` |
| D12 | Fluxo de update/staging existe em dois orquestradores (runtime cíclico e updater standalone) | `runtime/runtime.entry.ts:1581`, `runtime/runtime.entry.ts:1638`, `runtime/runtime.entry.ts:1715`; `updater/updater.entry.ts:273`, `updater/updater.entry.ts:279`, `updater/updater.entry.ts:367` | regra de update pode divergir por execução (ciclo vs job standalone) | alta | `release/` |

## Cobertura mínima exigida (atendida)

As duplicações mínimas solicitadas estão cobertas:

- parsing/env: `D1`
- serialização + persistência config: `D3`, `D4`
- resolução paths/layout: `D5`
- placeholder/bootstrap enrollment: `D2`
- update checks policy: `D6`
- leitura/escrita de estado local: `D4`, `D7`, `D8`, `D10`
- regras de log tail/refresh: `D9`
