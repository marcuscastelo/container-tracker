# Agent Refactor Fase 1 — File Inventory (`apps/agent/src`, sem `tests`)

Data: 2026-04-14  
Escopo canônico: `apps/agent/src/**` (exclui `apps/agent/src/tests/**`)  
Total de arquivos no escopo: **79**

## Critério de risco (congelado)

- `alto`: arquivo cobre mais de 2 áreas (`config/paths/runtime/release/sync/providers/state/observability/platform`) **ou** concentra loop/process control.
- `médio`: arquivo cobre exatamente 2 áreas.
- `baixo`: arquivo cobre 1 área principal (wrapper fino, contrato, recurso estático, entrypoint fino).

## Inventário

| Arquivo | Primária | Secundárias | Dependências externas | Side effects | IO principal | Risco | Observação de acoplamento |
|---|---|---|---|---|---|---|---|
| `apps/agent/src/agent.scheduler.ts` | runtime (scheduler) | observability | timers Node | `setInterval/clearInterval`, coalescing de execução | tempo/event loop | médio | contrato central de disparo para runtime |
| `apps/agent/src/agent.ts` | app (legacy entry wrapper) | runtime | `@agent/runtime/runtime.entry` | carrega módulo com side effects de boot | processo | baixo | compat wrapper para entrypoint canônico |
| `apps/agent/src/backoff.ts` | core (policy util) | runtime | `Math.random` | nenhum além de cálculo | valores numéricos | baixo | reutilizado por enrollment/retry |
| `apps/agent/src/build-release.ts` | release (build pipeline) | platform, config, observability | `node:fs`, `node:child_process`, `fetch`, `zod` | escreve artefatos, spawn de comandos, downloads, valida preflight | FS + rede | alto | mega-orquestrador de empacotamento/distribuição |
| `apps/agent/src/bundle-release.ts` | release (bundle zip) | observability | `node:fs`, `spawn(zip)` | leitura/empacotamento de diretórios e arquivos | FS | médio | acoplado ao layout de release/installer |
| `apps/agent/src/cli/ct-agent-admin.ts` | app (CLI admin router) | state, runtime, release | `zod`, `@agent/bootstrap`, `@agent/control-core` | executa comandos administrativos, grava snapshots públicos | stdout/stderr + FS | alto | roteia muitos comandos e integra múltiplos owners |
| `apps/agent/src/cli/ct-agent.ts` | runtime (CLI operacional) | config, platform, observability | `node:child_process`, `fetch`, `zod` | enroll, restart serviço, tail logs, grava config | FS + rede + subprocesso | alto | duplica decisões de config/enroll com runtime principal |
| `apps/agent/src/config/config.contract.ts` | core (contrato de paths) | config | tipos TS | nenhum | tipos | baixo | shape canônico de `AgentPathLayout` |
| `apps/agent/src/config/resolve-agent-paths.ts` | config (path layout) | platform, state | `node:fs`, `node:path`, env | cria diretórios, resolve paths estáveis | FS + env | alto | owner efetivo do layout local (`current/previous/releases`) |
| `apps/agent/src/config/resolve-agent-public-paths.ts` | config (compat re-export) | state | `@agent/runtime/paths` | nenhum | tipos/paths | baixo | wrapper compat para caminhos públicos |
| `apps/agent/src/control-core/agent-control-core.ts` | core (control orchestration) | config, state, release, observability, sync | `fetch`, `zod`, `@agent/*` | lê/escreve config/cache/state, chama backend control, grava auditoria | FS + rede | alto | hotspot de regras de precedência (base/local/remoto) |
| `apps/agent/src/control-core/contracts.ts` | core (control contracts) | state | `zod` | valida schemas | JSON/DTO | baixo | contrato semântico do plano de controle |
| `apps/agent/src/control-core/local-control-service.ts` | runtime (local control service) | state, release, platform, observability | `node:fs`, `@agent/platform`, `@agent/release-*` | start/stop/restart agent, update config, rollback/activate release | FS + subprocesso | alto | mistura controle de serviço com mutação de release/config |
| `apps/agent/src/control-core/public-control-files.ts` | state (public snapshots/logs) | observability | `node:fs`, `@agent/control-core` | escreve/atualiza arquivos públicos (`/run`), tail logs | FS | médio | sobrepõe leitura de logs com publicação de estado público |
| `apps/agent/src/control-core/public-control-state.ts` | state (public state projection) | release | `node:fs`, `@agent/release-manager` | escreve snapshot público e inventário de releases | FS | médio | owner de projeção pública do estado operacional |
| `apps/agent/src/control/control.commands.ts` | core (command schema) | control API | `zod` | valida payloads | JSON | baixo | contrato de comando de alto nível |
| `apps/agent/src/control/control.contracts.ts` | core (command result schema) | state | `zod`, `@agent/control/control.state` | valida resultado | JSON | baixo | tipagem de saída para rotas/UI |
| `apps/agent/src/control/control.service.ts` | app (control composition) | runtime | `@agent/control-core/local-control-service` | dispatch de comandos para serviço local | memória | médio | roteador de comandos com acoplamento a local service |
| `apps/agent/src/control/control.state.ts` | core (state alias) | control API | `@agent/control-core/contracts` | nenhum | tipos | baixo | compat alias para snapshot schema |
| `apps/agent/src/electron/electron.d.ts` | core (electron typings) | app | tipos Electron | nenhum | tipos | baixo | suporte de tipagem para build UI |
| `apps/agent/src/electron/ipc-compat.ts` | app (IPC compat wrapper) | core | `@agent/electron/ipc` | nenhum | IPC channel constants | baixo | compat exports para consumidores legados |
| `apps/agent/src/electron/ipc.ts` | core (IPC contract) | app | `zod`, `@agent/control-core/contracts` | valida payload IPC | IPC payloads | baixo | contrato canônico de IPC renderer/main |
| `apps/agent/src/electron/linux-installed-service.ts` | app (compat wrapper) | runtime | `@agent/electron/main/installed-linux-control-service` | nenhum | chamadas de serviço | baixo | wrapper de compatibilidade de localização |
| `apps/agent/src/electron/main.ts` | app (electron entry wrapper) | runtime | `@agent/electron/main/electron-main` | boot do main process | processo Electron | baixo | entrypoint fino |
| `apps/agent/src/electron/main/electron-main.ts` | app (Electron composition root) | runtime, observability, state | `electron`, `@agent/bootstrap`, `@agent/electron/ipc` | cria janela/tray, registra handlers IPC, carrega UI | IPC + processo + FS | alto | owner atual de composição UI + bridge de controle |
| `apps/agent/src/electron/main/installed-linux-control-service.ts` | runtime (installed Linux control bridge) | state, observability, platform | `execFile(pkexec)`, `@agent/control-core/public-*` | executa `ct-agent-admin` privilegiado, lê snapshots/logs públicos | subprocesso + FS | alto | bridge de privilégio/instalação linux |
| `apps/agent/src/electron/main/window-controller.ts` | app (window lifecycle) | none | tipos utilitários | controla hide/show/focus/single-instance | estado em memória | baixo | isolado e puro (boa separação) |
| `apps/agent/src/electron/preload.cjs` | app (preload bridge) | core | `electron` IPC renderer | expõe API segura ao renderer | IPC | médio | fronteira crítica entre renderer e main |
| `apps/agent/src/electron/renderer/AgentControlApp.tsx` | app (control UI) | observability | SolidJS | render UI, dispara comandos IPC | interação UI + IPC | médio | componente grande, mas fora do runtime backend |
| `apps/agent/src/electron/renderer/main.tsx` | app (renderer bootstrap) | none | SolidJS render | monta app no DOM | DOM | baixo | bootstrap fino |
| `apps/agent/src/electron/window-controller.ts` | app (compat wrapper) | none | `@agent/electron/main/window-controller` | nenhum | tipos/funções | baixo | wrapper de compatibilidade |
| `apps/agent/src/installer/ContainerTrackerAgent.xml` | platform (Windows task template) | runtime bootstrap | Task Scheduler XML | nenhum em runtime (artefato) | arquivo de template | baixo | contrato de instalação legada |
| `apps/agent/src/installer/agent-tray-host.ps1` | app (Windows tray host script) | observability, runtime control | PowerShell APIs | abre UI/logs, inicia/reinicia serviços | subprocesso + shell | médio | separado do runtime Node, mas acoplado a paths |
| `apps/agent/src/installer/bootstrap.env.template` | config (bootstrap template) | install | template env | nenhum | arquivo template | baixo | fonte de bootstrap inicial |
| `apps/agent/src/installer/installer.iss` | platform (Inno Setup spec) | release bootstrap | Inno Setup | build/registro de instalador | artefato de build | baixo | somente fase de instalação inicial |
| `apps/agent/src/installer/resources/tray.ico` | app asset | none | recurso binário | nenhum | ícone | baixo | ativo estático |
| `apps/agent/src/installer/run-supervisor.ps1` | runtime bootstrap | platform | PowerShell | inicia supervisor no host Windows | subprocesso | baixo | launcher OS-specific |
| `apps/agent/src/installer/stop-agent-runtime.ps1` | runtime control | platform | PowerShell | encerra runtime/supervisor | subprocesso | baixo | script operacional local |
| `apps/agent/src/installer/updater-hidden.ps1` | release/update runner | platform | PowerShell | executa updater em modo oculto | subprocesso | baixo | isolado para UX Windows |
| `apps/agent/src/log-forwarder.ts` | observability (log shipping) | runtime, sync | `fetch`, `node:fs`, timers | tail incremental de logs, POST `/api/agent/logs`, persistência de sequência | FS + rede + timers | alto | owner de fila local/retry/backoff de log ingest |
| `apps/agent/src/pending-activity.ts` | state (activity queue file) | observability | `node:fs`, `zod` | append/drain de eventos pendentes em JSON | FS | médio | fila de atividades compartilhada entre runtime/supervisor/updater |
| `apps/agent/src/platform/common.ts` | platform (subprocess utils) | none | `spawnSync`, `node:fs` | executa comandos síncronos, valida diretórios | subprocesso + FS | baixo | util compartilhado por adapters |
| `apps/agent/src/platform/linux.adapter.ts` | platform (Linux adapter) | runtime control, release extraction | `spawn`, `tar/unzip`, `os/path` | start/stop runtime, resolve dataDir, extract bundles | subprocesso + FS | médio | isolamento Linux específico |
| `apps/agent/src/platform/local-control.adapter.ts` | platform (service control adapter) | runtime control | `execFile(systemctl/schtasks/cmd)` | start/stop/query serviços locais | subprocesso | médio | concentra decisão operacional por OS de service control |
| `apps/agent/src/platform/platform.adapter.ts` | platform (adapter resolver) | core | env/process arch | resolve adapter por `platform/arch` | memória | baixo | ponto único de seleção Linux/Windows |
| `apps/agent/src/platform/platform.contract.ts` | core (platform contracts) | runtime/release | tipos TS | nenhum | tipos | baixo | interface oficial da camada platform |
| `apps/agent/src/platform/platform.types.ts` | core (platform types re-export) | platform | tipos TS | nenhum | tipos | baixo | alias de tipos para imports estáveis |
| `apps/agent/src/platform/windows.adapter.ts` | platform (Windows adapter) | runtime control, release extraction | `spawn`, `powershell`, `tar` | start/stop runtime, resolve LocalAppData, extract zip/tgz | subprocesso + FS | médio | isolamento Windows específico |
| `apps/agent/src/rebuild-reinstall.ps1` | release/install ops | platform, observability | PowerShell + installer toolchain | rebuild bundle, reinstala e imprime tail de logs | subprocesso + FS | médio | script operacional fora do ciclo de runtime |
| `apps/agent/src/release-manager.ts` | release (activation/rollback links) | state | `node:fs`, symlink ops | cria/remove `current/previous`, ativa/rollback release | FS | alto | state machine de release é crítica e acoplada ao layout |
| `apps/agent/src/release-state.ts` | state (release state file) | release | `node:fs`, `zod` | lê/migra/escreve `release-state.json` | FS | médio | owner de política de bloqueio/failure tracking |
| `apps/agent/src/release/release-manifest.ts` | release (manifest parsing/policy) | platform | `zod`, `fetch`, `resolveAgentPlatformKey` | lê manifest local/remoto, compara versões | rede + FS | médio | contrato de canal/plataforma do update |
| `apps/agent/src/renderer/AgentControlApp.tsx` | app (compat renderer wrapper) | none | `@agent/electron/renderer/AgentControlApp` | nenhum | UI component export | baixo | wrapper para compat de import path |
| `apps/agent/src/renderer/agent-control-window.d.ts` | core (window typings) | app | tipos | nenhum | tipos | baixo | tipagem global da bridge de UI |
| `apps/agent/src/renderer/index.html` | app (renderer shell) | none | HTML | nenhum | DOM shell | baixo | recurso estático |
| `apps/agent/src/renderer/main.tsx` | app (compat renderer bootstrap) | none | `@agent/electron/renderer/main` | nenhum | DOM bootstrap | baixo | wrapper de compatibilidade |
| `apps/agent/src/renderer/styles.css` | app (UI styles) | none | CSS | nenhum | folha de estilo | baixo | recurso estático |
| `apps/agent/src/runtime-health.ts` | state (runtime health file) | observability | `node:fs`, `zod` | escreve/lê `runtime-health.json` | FS | médio | contrato local de health gate |
| `apps/agent/src/runtime-paths.ts` | config (canonical path re-export) | state | `@agent/config/*`, `@agent/runtime/paths` | nenhum | paths/tipos | baixo | wrapper canônico atual para imports estáveis |
| `apps/agent/src/runtime/alias-loader.ts` | app/runtime bootstrap | core | `node:fs/path` | registra aliases para execução runtime | filesystem resolve | baixo | suporte técnico de boot |
| `apps/agent/src/runtime/lifecycle-exit-codes.ts` | core (exit contract) | runtime/release | constantes | nenhum | códigos de saída | baixo | contrato supervisor/runtime/updater |
| `apps/agent/src/runtime/paths.ts` | config+platform (canonical resolver) | state | `node:fs/path`, `resolvePlatformAdapter` | resolve `AGENT_DATA_DIR`, valida acesso, resolve paths públicos | env + FS | alto | owner real de decisão DATA_DIR/public state |
| `apps/agent/src/runtime/register-alias-loader.ts` | app/runtime bootstrap | core | `node:path/url` | registra loader por `--import` | processo | baixo | suporte de execução de bundles |
| `apps/agent/src/runtime/runtime.entry.ts` | runtime (main loop) | config, sync, providers, release, state, observability, platform | `fetch`, `@supabase/supabase-js`, fetchers carriers, timers, fs | enroll, heartbeat, polling, ingest, realtime, update check, signal shutdown | rede + FS + timers + processo | alto | mega-orquestrador central (principal hotspot) |
| `apps/agent/src/supervisor-control.ts` | state (supervisor control file) | runtime | `node:fs`, `zod` | escreve/lê `supervisor-control.json` | FS | médio | controle de drain/restart entre runtime e supervisor |
| `apps/agent/src/supervisor.ts` | app (supervisor entry wrapper) | runtime | `@agent/supervisor/supervisor.entry` | boot supervisor main | processo | baixo | wrapper de entrypoint |
| `apps/agent/src/supervisor/runtime-stdio-log-writer.ts` | observability (stdio rotation writer) | runtime | `node:fs`, timers | rota/rotaciona stdout/stderr de runtime | FS | médio | util de observabilidade crítico para supervisor |
| `apps/agent/src/supervisor/supervisor.entry.ts` | runtime (supervision state machine) | release, state, observability, platform | `node:fs/path`, `resolvePlatformAdapter`, timers | spawn runtime, health gate, activation/rollback, publish snapshot/logs públicos | subprocesso + FS + timers | alto | hotspot de lifecycle/rollback |
| `apps/agent/src/update-checks.ts` | core (update checks policy) | config | env parsing | nenhum | env/config values | baixo | policy central de disable flag vs channel |
| `apps/agent/src/updater.core.ts` | release (update fetch/stage core) | platform, state | `fetch`, `node:fs`, `release-manager` | download, checksum, extração, grava release staged | rede + FS | médio | núcleo de staging reutilizado por runtime/updater |
| `apps/agent/src/updater.ts` | app (updater wrapper entry) | config | `@agent/runtime-paths`, `@agent/updater/updater.entry` | garante `DOTENV_PATH` e inicia updater | env + processo | baixo | wrapper compat para entrypoint updater |
| `apps/agent/src/updater/updater.entry.ts` | release (standalone updater runtime) | config, state, observability, platform | `fetchUpdateManifest`, `stageReleaseFromManifest`, `pending-activity`, `runtime-paths` | lê config, verifica update, stage release, escreve release-state, pede drain | rede + FS + processo | alto | replica decisões de update já presentes em `runtime.entry.ts` |
| `apps/agent/src/bootstrap/create-agent-runtime.ts` | app (bootstrap composition) | config | `@agent/runtime-paths` | garante diretórios de runtime | FS | baixo | composition root fino |
| `apps/agent/src/bootstrap/create-control-service.ts` | app (bootstrap composition) | runtime control | `@agent/control/control.service` | instancia serviço | memória | baixo | composition root fino |
| `apps/agent/src/bootstrap/create-platform-adapter.ts` | app (bootstrap composition) | platform | `@agent/platform/platform.adapter` | resolve adapter | memória | baixo | composition root fino |
| `apps/agent/src/bootstrap/electron-entry.ts` | app (entrypoint) | electron | `@agent/electron/main/electron-main` | boot electron main | processo | baixo | entrypoint fino |
| `apps/agent/src/bootstrap/runtime-entry.ts` | app (entrypoint) | runtime | `@agent/runtime/runtime.entry` | boot runtime main | processo | baixo | entrypoint fino |
| `apps/agent/src/bootstrap/supervisor-entry.ts` | app (entrypoint) | runtime | `@agent/supervisor/supervisor.entry` | boot supervisor main | processo | baixo | entrypoint fino |
| `apps/agent/src/bootstrap/updater-entry.ts` | app (entrypoint) | config, release | `@agent/runtime-paths`, `@agent/updater/updater.entry` | garante `DOTENV_PATH` e boot updater | env + processo | médio | overlap funcional com `src/updater.ts` |

## Cobertura e notas

- Inventário cobre exatamente os 79 arquivos no escopo definido para Fase 1.
- `apps/agent/src/tests/**` ficou explicitamente fora por decisão de escopo desta fase.
- Não houve modificação de comportamento; apenas classificação documental.
