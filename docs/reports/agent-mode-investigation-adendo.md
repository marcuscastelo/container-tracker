# Agent Linux Operational Design Investigation — Adendo (Pre-systemd)

Data: 2026-03-11

Objetivo
--------
Complementar a investigação anterior com decisões arquiteturais necessárias antes de implementar suporte operacional Linux via `systemd`. Este adendo foca em quem é responsável por quê no runtime, sem propor implementação técnica (sem unit files, sem código, sem comandos systemd).

Legenda de evidência
- confirmado: encontrado no código ou documentação canônica
- inferido: dedução razoável a partir do código/arquivos existentes
- não encontrado: ausência explícita na base atual
- divergente doc vs código: conflito entre docs e implementação

Regras aplicadas
--------------
- Não gerar unit file, nem código, nem comandos systemd.
- Separar claramente runtime vs packaging vs orchestration.

## 1. Key Architectural Decisions

Lista mínima de decisões que precisam ser tomadas antes de implementar suporte systemd:

1. Quem é o supervisor primário em tempo de execução (systemd vs supervisor.js vs híbrido).
2. Quem controla updates (self-update runtime vs package manager vs híbrido) e o protocolo de staging/rollback.
3. Contrato canônico de layout de dados em disco para Linux (paths, variáveis, arquivos persistidos).
4. Surface operacional mínima para Linux (headless, CLI, ou desktop/tray) e quais ferramentas/UX são obrigatórias.
5. Modelo de empacotamento suportado oficialmente (deb/rpm vs tar vs container) e como afetará upgrades e rollback.
6. Atribuição explícita de garantias operacionais (quem fornece restart, health checks, logs, boot-start).

Cada decisão deve registrar: responsável, impacto operacional, requisitos de segurança, auditabilidade e compatibilidade com staged releases.

## 2. Supervisor Model Comparison

Resumo comparativo (supervisor.js | systemd | híbrido)

- supervisor.js (atual)
  - Papel: supervisor interno (scripts em `tools/agent/supervisor.ts`).
  - Confirmado: supervisor existe e implementa health gate, restart on crash, staged release activation e rollback. (confirmado)
  - Vantagens: lógica de rollout/rollback e comportamento cross-platform já presente; controlos finos sobre staging.
  - Desvantagens: duplicação com systemd, risco de dupla supervisão, signals e restart-loop difícil de raciocinar.
  - Operacional: reinício por crash e gate de saúde ficam no supervisor; systemd atuaria apenas como launcher/boot-start.
  - Evidência: código de `supervisor.ts` (confirmado).

- systemd
  - Papel: tornar-se o supervisor real do processo runtime.
  - O que migrar: restart policy, start at boot, health checks via `Watchdog` / `systemd-notify` (opcional), e a responsabilidade de reinicios automáticos.
  - Vantagens: integração com distro tooling, transparência para operadores, logs via journal, gestão de dependências de boot.
  - Desvantagens: perda de cross-platform supervisor control (staged releases/rollbacks precisariam ser re-implementados ou reexpostos), barreira de compatibilidade com deploys via package managers.
  - Operacional: supervisor.js teria que ceder responsabilidades (staging + rollback), ou funcionar apenas como um agente de orquestração interna sem lifecycle supervision.
  - Evidência: systemd não está presente no repo (não encontrado) — design atual não assume systemd como supervisor.

- Híbrido (systemd + supervisor.js)
  - Papel: systemd garante boot/start/restart de baixo nível; supervisor.js mantém logic de rollout/staging/health gating.
  - Vantagens: mantém lógica de rollout existente; ganha a integração distro-level para boot/start/logs.
  - Desvantagens: complexidade de responsabilidades; risco de restart race (systemd vs supervisor) — precisa de contrato claro de exit codes e signals.
  - Requisitos: protocolo de handshake simples (ex.: código de saída específico para update: já existe exit code 42 — confirmado); supervisor deve usar exit codes definidos para sinalizar ao systemd quando reiniciar/atualizar vs quando manter down.

Comparação (concisa)
- restart policy: melhor no systemd (consistente) ou no supervisor (mais flexível)? — trade-off entre integrabilidade (systemd) e funcionalidade de rollout (supervisor).
- health gating: preferível manter no runtime/supervisor (domain-aware) e surface via systemd only for process liveness.

Recomendações de decisão (ver seção 6).

## 3. Update Strategy Analysis

Opções comparadas: self-update (runtime), package-managed (deb/rpm), híbrido.

- Self-update (status quo: runtime controla `runUpdateCheck()`)
  - Evidência: `runUpdateCheck()`, `fetchUpdateManifest()`, `stageReleaseFromManifest()`, exit code `42` → supervisor restart (confirmado).
  - Impacto operacional: instala releases fora de package manager; flexível e imediato; exige mecanismos de verificação, assinatura e rollback implementados no agent.
  - Rollback: já existe staging + rollback logic (confirmado); precisa garantir atomicidade e integridade; operação auditável apenas se o agent persistir release-state e logs (requer explicit contract de persistência).
  - Segurança: exige assinatura verificável da release e controle de onde baixar; aumenta superfície de atualização (network + disk writes).
  - Compatibilidade: funciona bem para distribuições sem package infra, mas conflita com distro package managers (dpkg/apt/rpm/yum).

- Package-managed update (deb/rpm)
  - Impacto operacional: upgrades controlados por distro/package manager; patches via apt/yum; integração com CVE/management tools.
  - Rollback: depende do package manager (less flexible than custom staging); staged rollout via repo control (canary repos) em vez de per-host staging.
  - Auditabilidade: alta (package manager logs, apt history), mas menos controle aplicativo-por-aplicativo.
  - Security: usa distro mechanisms (signed repos), provavelmente mais robusto.
  - Compatibilidade: exige que releases sejam empacotadas e publicados em repositórios; não cobre containerized installs or manual tarballs.

- Híbrido
  - Modelos possíveis: agent baixa artefato e grava, mas pede ao systemd/restart manager para reiniciar; ou agent registra atualização em `release-state.json` e package manager or orchestration finaliza ativação.
  - Trade-offs: mantém conveniência de fast rollouts (self-update) e integridade/audit do package-managed model if combined with signed manifests & persisted release-state.
  - Requisitos: definir claramente quem executa a substituição de binários, e quem realiza a ativação (exit+restart). Ex.: agent baixa e valida artefato → escreve `release-state.json` com metadata e exit(42) → supervisor/systemd reinicia e ativa.

Impactos por critério
- Rollback: self-update tem rollback custom; package-managed depende de pacote; híbrido permite ambos se bem projetado.
- Auditabilidade: melhor com package-managed ou com runtime que persiste metadata e logs assinados.
- Segurança: sempre exigir assinatura e validação do manifest; não confiar em HTTP sem verificação.

## 4. Linux Runtime Contract (Cross-Platform)

Observações iniciais
- Há código que usa `path.win32` em cálculos de diretório — isto é divergente se não houver abstração (divergente doc vs código).

Contrato proposto (canônico Linux)

1) Diretório de dados principal (runtime writable, gerenciado pela distribuição):

   - Primário: `/var/lib/container-tracker-agent/` (conforme padrão de Linux para dados de serviço).
     - `config.env` (bootstrap + configurações base — não secretas sensíveis sem permissão adequada)
     - `bootstrap.env` (informações de enrollment preservadas)
     - `runtime-health.json` (health heartbeat persistente e última observação)
     - `release-state.json` (metadata sobre staged release, checksums, assinaturas, estado de ativação)
     - `logs/` (opcional; preferir logging to stdout/stderr + systemd journal; ter logs locais para debugging offline)

2) Diretório de configuração legível por admin
   - `/etc/container-tracker-agent/` — configurações gerenciadas pelo administrador/distribution (por exemplo, repo de updates, feature-flags administráveis)

3) Diretório para executáveis/bin
   - `/usr/lib/container-tracker-agent/` ou `/opt/container-tracker-agent/` quando empacotado.

4) Dados por usuário (quando run como user service)
   - Se houver modo per-user: `~/.local/share/container-tracker-agent/` (inferido)

Variáveis de ambiente e override
- `AGENT_DATA_DIR` — deve resolver completamente o diretório de runtime; quando presente, prevalece (confirmado: repo já observa alguma env var? não encontrado — inferir necessidade).
- `AGENT_CONFIG_DIR` — override para `/etc` analógico.
- `AGENT_RUNTIME_MODE` — `system` | `user` | `dev` (opcional, para adaptar paths).

Paths obrigatórios (mínimos)
- data dir (escritura persistente) — obrigatório
- config dir (leitura admin) — recomendado
- release-state.json — obrigatório para auditabilidade do update
- runtime-health.json ou heartbeat endpoint — recomendado

Notas de compatibilidade
- O agent não deve depender de `%LOCALAPPDATA%` semantics no Linux (não encontrado) — qualquer uso de `path.win32` deve ser substituído por uma camada de abstração que consome `AGENT_DATA_DIR` ou resolve por plataforma (divergente doc vs código).

## 5. Linux Operational Surface (UX)

Opções: headless only | CLI control tool | desktop tray

- Headless only
  - Impacto operacional: menor esforço; bom para servidores; integração natural com systemd and logs → developer/ops oriented.
  - Utilidade: suficiente para servidores; limitado para usuários desktop que esperam UI.

- CLI control tool (recomendado como mínima)
  - Impacto: implementação leve; oferece comandos para `status`, `logs`, `restart`, `upgrade-status`, `enroll`, `bootstrap`.
  - Utilidade: cobre a maioria dos cenários operacionais sem GUI; permite automação e scripting.

- Desktop tray (equivalente ao Windows tray)
  - Impacto: maior esforço; requer empacotamento GUI (Electron/Tray host) e multiplas integrações desktop (X11/Wayland). Pode duplicar funcionalidades do tray Windows que podem não ser necessárias.
  - Utilidade: bom para usuários desktop que necessitam de visibilidade imediata; pouco valor em infra-headless.

Recomendação (prioridade mínima)
1. CLI control tool — obrigatório para Linux (boa relação custo/benefício).
2. Headless service mode (systemd-managed) — obrigatório.
3. Desktop tray — opcional, avaliar por demanda de produtos/usuários; não obrigatório no primeiro rollout.

## 6. Packaging Model — comparação e implicações

Opções: tarball/manual | `.deb`/`.rpm` | container image | multi-target

- tarball/manual
  - Simples, baixo esforço para publicação; upgrades manuais; pouca integração com distro tooling.

- `.deb` / `.rpm` (recomendado como alvo primário)
  - Fornece integração com package manager (apt/yum), logs de instalação, melhor auditabilidade, e mecanismos de upgrade/rollback via repo control.
  - CI/CD: gerar artefatos e publicar em repositórios APT/YUM ou proxies (artifactory).

- container image
  - Bom para cloud/container deployments; não cobre hosts gerenciados diretamente via package manager.

- multi-target
  - Ideal a longo prazo: oferecer `.deb`/`.rpm` + container images + tarball para dev/manual.
  - Aumenta CI complexity.

Impacto em updates
- Package-managed simplifica gerenciamento centralizado; self-update precisa coexistir com package-managed

Recomendação: priorizar empacotamento `.deb`/`.rpm` (multi-arch se possível) + oferecer tarball dev-friendly; container images como canal separado.

## 7. Operational Guarantees (quem fornece o quê)

Garantias esperadas e atribuição sugerida:

- Crash restart
  - Preferência: systemd (process manager) para host-level restart. (recomendado)
  - Complemento: supervisor.js pode detectar crashes de sub-processos e agir com lógica de rollback/alert, mas não deve competir com systemd no processo primário.

- Update restart
  - ownership: runtime inicia o fluxo (download/validação/staging), mas request restart via agreed exit code; systemd ou supervisor realiza o restart.
  - mecanismo: exit code reservado (ex.: 42) — confirmado no repo; documentar formalmente.

- Health monitoring
  - ownership: runtime/supervisor (domain-aware health gate); systemd fornece liveness watchdog se necessário.

- Log access
  - ownership: runtime escreve logs para stdout/stderr; systemd/journal fornece armazenamento central. Optionally persist logs localy for offline analysis (in data dir).

- Boot start
  - ownership: systemd/package manager handles boot-time start (installation registers service) — recommended.

- Manual restart
  - ownership: CLI tool exposes manual control; systemd `systemctl restart` remains available for operators.

- Upgrade safety
  - ownership: shared — runtime performs validation/staging, packaging infra controls distribution; both must persist `release-state.json` for audit.

Resumo em tabela curta (responsabilidade principal)
- runtime/supervisor: health gating, staged rollout logic, update validation, rollback logic, release-state persistence.
- systemd: boot start, low-level crash restart, journal logging, watchdog liveness.
- package manager: distribution, repo-managed upgrades, global audit logs.

## 8. Recommended Direction (sem implementação)

1. Adotar modelo híbrido com contrato claro: systemd é supervisor primário para boot/restart/logging; `supervisor.js` mantém a lógica de rollout/staging/rollback, mas opera como process-internal orchestrator (não como primary lifecycle manager).
   - Racional: preserva investimento em rollout logic e traz benefícios operacionais do systemd.
   - Implementação futura (após decisão): definir exit codes e handshake (ex.: 42 = update-activate-request; 100+ codes para maintenance) e documentar.

2. Update strategy: preferir híbrido.
   - Agent continua capaz de baixar/validar/stage releases e persistir `release-state.json` com assinatura e checksums (auditável).
   - Ativação por restart fica a cargo do systemd (ou supervisor se for o caso de deploy sem systemd).

3. Paths: formalizar `AGENT_DATA_DIR` e defaults Linux:
   - default data dir: `/var/lib/container-tracker-agent`
   - config dir: `/etc/container-tracker-agent`
   - bin dir: `/usr/lib/container-tracker-agent` ou `/opt` conforme empacotamento
   - exigir que todos os cálculos de path usem abstração cross-platform (resolver uso `path.win32`) — tarefa técnica a ser priorizada.

4. UX mínima:
   - fornecer CLI control tool como prioridade mínima (status/logs/restart/upgrade-status)
   - operar headless por default
   - considerar tray só se demanda de desktop justificar esforço adicional

5. Packaging:
   - priorizar `.deb`/`.rpm` no roadmap de distribuição, além de tarball dev e container images como canais secundários.

## 9. Risks (classificação)

- Crítico
  - Dupla supervisão sem contrato claro → restart loops / lost signals / race conditions. (mitigação: definir contrato de exit codes e responsabilidades)
  - Atualizações inseguras sem verificação de assinatura → risco de supply-chain compromission. (mitigação: exigir assinatura e persistir metadata auditável)

- Importante
  - Divergências em paths (uso de `path.win32`) → comportamentos não-determinísticos em Linux. (mitigação: refatorar path abstraction)
  - Falta de CLI → dificultará operações em hosts sem GUI. (mitigação: priorizar CLI)

- Desejável
  - Empacotamento multi-target pronto no primeiro lançamento. (mitigação: priorizar deb/rpm e oferecer tarball)

Evidência por item
- supervisor.ts: confirmado (código presente) → supervisor.js é funcional.
- runUpdateCheck + exit 42: confirmado (código presente).
- Uso de `path.win32`: divergente (detectado na investigação anterior) — tratar como pendência técnica.

## 10. Próximos passos operacionais (sem implementação)

1. Formalizar documento de contrato de exit codes e lifecycle handshake (exit codes + signals) — alto prioridade.
2. Criar especificação de `AGENT_DATA_DIR` e migrar código para usar uma camada de path-abstraction; eliminar `path.win32` usage.
3. Projetar CLI control tool (especificar comandos e UX) e priorizá-lo para Linux.
4. Decidir canal principal de distribuição (deb/rpm) e alinhar CI para gerar esses artefatos.

---

Anexos / Notas
- Marcações de evidência: ver: `tools/agent/supervisor.ts`, `tools/agent/agent.ts`, e referências a `runUpdateCheck()` no código base (confirmado). Qualquer conflito entre docs e código foi marcado como "divergente".

### Adendo 2 — Arch Linux / AUR-compatible packaging

Como ambiente operacional real de validação, Linux deve incluir também um alvo **Arch/AUR-compatible**, mesmo sem publicação no AUR oficial.

Objetivo:
- permitir instalação local com `makepkg -si`
- validar o contrato real de packaging Linux em Arch
- testar unit/service install, filesystem layout, permissions e upgrade path em ambiente de uso real

Direção revisada de packaging Linux:
1. AUR-compatible package build (`PKGBUILD`)
2. `.deb` / `.rpm`
3. tarball dev/manual
4. container image como canal separado

Requisitos do alvo AUR-compatible:
- gerar pacote instalável localmente com `makepkg`
- respeitar layout Linux canônico (`/usr/lib` ou `/opt`, `/etc`, `/var/lib`)
- instalar artefatos de serviço de forma previsível
- preservar dados persistidos entre upgrades
- não depender de convenções Windows
- permitir auditoria clara do que é binário, config e state

Decisão arquitetural adicional:
7. Definir package targets Linux oficiais e seu contrato de instalação/upgrade:
- Arch/AUR-compatible
- `.deb`
- `.rpm`

Essa decisão deve explicitar:
- local de instalação dos binários
- local de config
- local de state mutável
- comportamento de upgrade
- comportamento de uninstall
- integração com o supervisor model escolhido
- 
Fim do adendo.
