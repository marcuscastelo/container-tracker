# ADR 0017 — Linux Agent Operational Model

Date: 2026-03-11  
Status: Accepted

## Context

O agent do Container Tracker atualmente possui um runtime cross-platform baseado em Node:

- `apps/agent/src/agent.ts`
- bootstrap/enroll
- scheduler interval + realtime wake
- scraping providers
- ingest de snapshots
- heartbeat
- graceful shutdown
- update check (`runUpdateCheck()`)

O Windows possui uma infraestrutura operacional completa:

- installer (Inno Setup)
- Task Scheduler
- tray host
- rebuild-reinstall flow

Linux hoje consegue rodar o runtime, mas **não possui modelo operacional formal**.

Problemas identificados:

- ausência de supervisor de processo Linux
- ausência de contrato de filesystem Linux
- ausência de packaging Linux
- uso potencial de `path.win32`
- ausência de surface operacional (CLI)

Antes de implementar suporte Linux, foi necessário definir:

- quem supervisiona o runtime
- quem controla updates
- layout de filesystem Linux
- surface operacional mínima

---

# Decision

Adotar **modelo híbrido de supervisão**:

```
systemd
   ↓
supervisor.js
   ↓
agent runtime
```

## Responsabilidades

### systemd

Responsável por:

- boot start
- crash restart
- lifecycle service
- journald logging

### supervisor.js

Responsável por:

- staged release activation
- rollback logic
- runtime child supervision
- health gating

### agent runtime

Responsável por:

- bootstrap
- scheduler
- scraping
- ingest
- heartbeat
- update detection
- staging release

Restart para ativação de update usa **exit code 42**.

---

# Linux Runtime Contract

## Data directory

Default:

```
/var/lib/container-tracker-agent
```

Contém:

```
config.env
bootstrap.env
runtime-health.json
release-state.json
logs/
```

Override possível via:

```
AGENT_DATA_DIR
```

---

## Config directory

```
/etc/container-tracker-agent
```

Configurações administráveis pelo operador.

---

## Binary directory

```
/usr/lib/container-tracker-agent
```

ou

```
/opt/container-tracker-agent
```

dependendo do packaging.

---

# Operational Surface

Linux será **headless-first**.

Surface mínima:

CLI tool:

```
ct-agent status
ct-agent logs
ct-agent restart
ct-agent update-status
ct-agent enroll
```

Desktop tray **não é prioridade**.

---

# Packaging Strategy

Targets Linux suportados:

1️⃣ Arch / AUR-compatible package (`PKGBUILD`)
2️⃣ `.deb`
3️⃣ `.rpm`
4️⃣ tarball dev
5️⃣ container image (opcional)

AUR-compatible package deve ser instalável com:

```
makepkg -si
```

Mesmo sem publicação no AUR oficial.

---

# Update Model

Modelo híbrido:

runtime:

- detecta update
- baixa artefato
- valida assinatura
- stage release
- grava `release-state.json`
- exit 42

supervisor/systemd:

- restart process
- ativa release

---

# Consequences

Benefícios:

- Linux torna-se first-class platform
- supervisor logic existente é preservada
- systemd fornece lifecycle robusto
- packaging Linux padronizado

Riscos:

- dupla supervisão se contratos não forem claros
- loops de update se `release-state.json` não for persistido corretamente
- inconsistência de paths se `path.win32` não for removido

Mitigações:

- formalizar exit codes
- criar abstraction layer de paths
- validar update state machine

---

# Follow-ups

Implementação fase 1:

- path abstraction
- lifecycle exit codes
- CLI mínima
- systemd-ready startup
- PKGBUILD

Fase 2:

- update hardening
- deb/rpm
- packaging pipeline