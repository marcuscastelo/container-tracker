# Agent mode investigation — Linux vs Windows flows

Data: 2026-03-11

# 1. Sufficiency Check
- docs suficientes: os documentos listados (`docs/AGENT_ARCHITECTURE.md`, `docs/SYNC_*`, `docs/SYNC_CODEMAP.md`, `docs/mvp-agent-sync.md`) cobrem arquitetura, contratos e fluxos do agent e servidor; são suficientes para uma avaliação inicial.
- pontos que precisam ser validados no código (evidência concreta):
  - entrypoint real usado em cada fluxo (dev vs release) — ver `package.json` e `tools/agent/*` (foi confirmado).
  - integração do updater no runtime (confirmar chamadas de `fetchUpdateManifest` / `stageReleaseFromManifest`) — ver `tools/agent/agent.ts` (confirmado).
  - layout do artefato `release/` e contrato do `bundle` — ver `tools/agent/build-release.ts` / `bundle-release.ts` (confirmado).
  - comportamento do fluxo `rebuild-restart` (Windows) — ver `tools/agent/rebuild-reinstall.ps1` (confirmado).

# 2. Executive Summary
- Entrypoint canônico de runtime: `tools/agent/agent.ts` (compilado para `dist`) — realiza bootstrap/enroll, scheduler (interval+realtime), scraping, ingest, heartbeat, update-check e shutdown.
- `agent:run` (Linux) = build + `scripts/agent/run-linux.sh` que executa `node .../supervisor.js`; o supervisor arranca/monitora o runtime filho e implementa health-gate, activation/rollback e restart-for-update.
- `agent:release` + `agent:bundle` constroem `release/` com `app/dist/agent.js`, `app/dist/updater.js`, `tools/agent/dist/.../supervisor.js` e depois empacotam `release/` + `installer/` num zip para distribuição (Windows installer é foco principal do instalador atual).
- Windows release: instalador (ISS/Inno) + Task Scheduler + tray (PowerShell) oferecem UX operacional (status, abrir logs, reiniciar). `rebuild-restart` recompila o bundle e dispara instalador e tasks.
- `bundle` produz instalador bundle (zip) — packaging only; não altera semantics do runtime.

# 3. Comparison Matrix
| Dimensão            | linux `agent:run`                                                                             | linux `release`                                                    | windows `release`                                                     | `bundle`                                         | `rebuild-restart`                                               |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| entrypoint          | `node tools/agent/dist/.../supervisor.js` (via `scripts/agent/run-linux.sh`)                  | `release/app/dist/agent.js` (supervisor-managed runtime selection) | installer installs `release/`; tray runs `node ...\app\dist\agent.js` | archive (zip) contendo `release/` + `installer/` | PS1 script que constrói bundle + installer e executa instalação |
| install/start       | manual/script or system service                                                               | supervisor + release layout (ready for installer)                  | installer (ISS) + Task Scheduler entries + Tray host                  | artifact for installer                           | builds and runs installer; triggers scheduled tasks             |
| background exec     | supervisor forks runtime child; restart on crash                                              | supervisor with health-gate & rollback                             | Task Scheduler + tray ensures background run                          | packaging only                                   | installer-led restart                                           |
| config/bootstrap    | DOTENV_PATH/`bootstrap.env` under AGENT_DATA_DIR (`.agent-runtime` / `%LOCALAPPDATA%`)        | same; release includes `release/config/bootstrap.env`              | installer writes `bootstrap.env` in `%LOCALAPPDATA%`                  | includes template                                | installer supplies `bootstrap.env`                              |
| persisted state     | `config.env`, `runtime-health.json`, `release-state.json`                                     | same                                                               | same in `%LOCALAPPDATA%`                                              | N/A                                              | N/A                                                             |
| logging             | supervisor rotates `logs/supervisor.log`; agent writes logs; `updater.log`                    | same                                                               | tray writes `agent.out.log`/`agent.err.log` and provides UI to open   | N/A                                              | N/A                                                             |
| restart             | supervisor auto-restart; agent uses exit code 42 -> supervisor restarts for update            | supervisor activates staged release and restarts                   | Task Scheduler + tray restart/monitor                                 | N/A                                              | installer triggers tasks to start services                      |
| update              | agent has `runUpdateCheck()` (manifest -> stage -> supervisor drain) + `updater.ts` utilities | release contains staged assets and supervisor handles activation   | installer/updater task coordinates update; tray helps UX              | produces installer bundle                        | rebuild-restart rebuilds bundle and runs installer              |
| user-facing surface | none native in Linux repo (logs + health files)                                               | same                                                               | tray UI (PowerShell) with status/restart/logs                         | N/A                                              | N/A                                                             |
| observability       | heartbeat to `/api/agent/heartbeat` + `runtime-health.json`                                   | same                                                               | same + tray provides easy log access                                  | N/A                                              | N/A                                                             |
| OS-specific deps    | Node >=22, supervisor (JS)                                                                    | release includes platform adapters                                 | Windows-specific installer + schtasks + PowerShell tray               | N/A                                              | Windows-only (ISCC + PowerShell)                                |

# 4. Code/Doc Evidence
- Entrypoint / runtime core
  - `tools/agent/agent.ts` — função `main()` (bootstrap, scheduler, realtime, update-check, shutdown) — CONFIRMADO
  - `docs/AGENT_ARCHITECTURE.md`, `docs/mvp-agent-sync.md` — doc cobrindo o fluxo — CONFIRMADO (alguma linguagem antiga sobre updater foi divergente, ver abaixo)
- agent:run (Linux)
  - `package.json` script `agent:run` -> `pnpm run agent:build && bash scripts/agent/run-linux.sh` — CONFIRMADO
  - `scripts/agent/run-linux.sh` -> executa `node tools/agent/dist/tools/agent/supervisor.js` — CONFIRMADO
  - `tools/agent/dist/tools/agent/supervisor.js` (fonte `tools/agent/supervisor.ts`) — health-gate, release activation/rollback, restart-for-update (exit code 42) — CONFIRMADO
- linux release / bundle
  - `tools/agent/dist/tools/agent/build-release.js` — cria `release/` com `app/dist/agent.js`, `app/dist/updater.js`, `tools/agent/dist/.../supervisor.js` e `config/bootstrap.env` — CONFIRMADO
  - `tools/agent/dist/tools/agent/bundle-release.js` — gera `dist/agent-installer-bundle.zip` com `release/` + `installer/` — CONFIRMADO
- windows release / tray / rebuild-restart
  - `tools/agent/installer/agent-tray-host.ps1` — PowerShell tray host (status, open logs, restart) — CONFIRMADO
  - `tools/agent/rebuild-reinstall.ps1` — reconstrói bundle, compila installer (ISCC), apaga tasks antigas, instala e inicia schtasks — CONFIRMADO
- updater / auto-update
  - `tools/agent/updater.core.ts`, `tools/agent/updater.ts` — fetchUpdateManifest, stageReleaseFromManifest — CONFIRMADO
  - `tools/agent/agent.ts` chama `runUpdateCheck()` dentro do ciclo (estágio -> writeReleaseState -> supervisor drain -> exit 42) — CONFIRMADO (doc antigo divergente)

# 5. Functional Decomposition
- Runtime core: `tools/agent/agent.ts` (bootstrap, scheduler, fetchers, ingest, heartbeat, update-check)
- Packaging/distribution: `tools/agent/build-release.ts`, `bundle-release.ts`, `release-manager.ts`, `release-state.ts`
- Startup orchestration: `scripts/agent/run-linux.sh` (dev) e `supervisor.ts` (runtime supervision)
- Background supervision: supervisor (cross-platform JS) vs Windows Task Scheduler + tray host
- Local UX surface: Windows-only tray (`agent-tray-host.ps1`); Linux UX missing in repo
- Update/restart path: manifest check -> stage release -> write release-state -> supervisor drain -> child exit 42 -> supervisor activates release

# 6. Linux systemd Readiness Assessment
- O que já está pronto (prós):
  - runtime tem supervisor com health file (`runtime-health.json`) e control path para drain; agent solicita restart-for-update de forma ordenada (CONFIRMADO em `agent.ts` e `supervisor.js`).
  - release layout é gerado e contém os artefatos necessários (`app/dist/agent.js`, `supervisor.js`, `updater.js`) — viável para execução por systemd (CONFIRMADO).
- O que está faltando (necessário para operador):
  - unit file systemd e instruções de instalação (DEVE SER ADICIONADO). Não encontrado no repo.
  - script de instalação (deb/rpm) e integração com logrotate/tmpfiles/permissions (não presente).
  - UX local equivalente ao tray (não encontrado) — se UX for requisito, precisa implementação Linux-native.
- O que é acoplado ao Windows:
  - instalador ISS/Inno e PowerShell tray/`schtasks` — forte dependência Windows para UX e installer.
- Bloqueadores críticos: nenhum técnico para rodar como serviço (supervisor + node funcionam); degradação é operacional (falta de unit/packaging). Entretanto é necessário ajustar path-layout cross-platform (`agent.ts` usa `path.win32` para defaults) — precisa confirmar comportamento em Linux (ver próximo tópico).

# 7. Risks and Gaps
- Crítico
  - ausência de tray/UX no Linux se a paridade UX for exigida.
  - ausência de unit/systemd e packaging Linux formal — operators terão que provisionar manualmente.
- Importante
  - documentação desatualizada sobre updater (algumas partes do doc sugeriam updater não integrado; código mostra integração) — risco de instruções operacionais incorretas.
  - caminhos/padrões de dados usam `path.win32` para defaults em `agent.ts::resolveDefaultDataDir()` — confirmar que, em execução Linux, `AGENT_DATA_DIR`/`DOTENV_PATH` são corretamente respeitados (mitigável definindo env vars). (INFERIDO -> confirmar operação em runner Linux real)
- Desejável
  - unit/systemd example, packaging deb/rpm, logrotate, e guia de permissões/selinux para produção.

# 8. Open Questions (essenciais)
1. Qual é a expectativa mínima de UX local no Linux? (só logs/ctl via CLI, ou equivalente a tray?)
2. Devemos fornecer unit file systemd e packaging (deb/rpm/flatpak) no repo ou deixar como artefato operacional externo?
3. Confirmar: em máquinas Linux, o `resolveDefaultDataDir()` (que usa `path.win32`) não fará o agente escrever em caminhos Windows-style — favor confirmar execução real com `agent:run` em Linux e reportar o `runtime-health.json` path.
4. Política esperada para auto-update: automática por canal `stable` (atual comportamento) é aceitável, ou prefere atualizar apenas via instalador/ops?

---
Evidências principais (resumo de arquivos/funções para auditoria rápida):
- `tools/agent/agent.ts`::`main()` (bootstrap, scheduler, runOnce, runUpdateCheck, shutdown)
- `scripts/agent/run-linux.sh` (entry wrapper used by `agent:run`)
- `tools/agent/dist/tools/agent/supervisor.js` (supervisor main loop — health gate, activate/rollback, restart-for-update)
- `tools/agent/dist/tools/agent/build-release.js` & `bundle-release.js` (release + bundle creation)
- `tools/agent/installer/agent-tray-host.ps1` (Windows tray host) and `tools/agent/rebuild-reinstall.ps1` (rebuild + installer)
- `tools/agent/updater.core.ts`, `tools/agent/updater.ts` (updater logic) — usado por `agent.ts` via `runUpdateCheck()`
