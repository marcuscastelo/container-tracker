# ADR-0012 — Unified Agent Release System (Linux + Windows)

Status: Accepted
Date: 2026-03-09

---

# Context

agent atualmente possui diferenças operacionais entre Linux e Windows:

Linux:
- execução direta do runtime Node
- restart via process spawn/systemd
- update por substituição de arquivos

Windows:
- instalação inicial via Inno Setup installer
- execução via Scheduled Tasks
- update potencialmente via reinstall

Entretanto, installer Windows **não é necessário para updates**.

Ele:

- cria diretórios
- copia runtime
- registra scheduled tasks
- inicializa config

Isso significa que installer pode ser tratado como **bootstrap-only**, e não como mecanismo contínuo de release.

Isso permite **unificar completamente sistema de release e update entre Linux e Windows**.

---

# Decision

sistema de releases do agent passa ser **idêntico entre Linux e Windows**.

Releases são bundles versionados ativados via:

- staging
- activation
- health check
- rollback

Installer Windows passa ser **usado na primeira instalação**.

Updates subsequentes são realizados via **bundle activation**, exatamente como Linux.

---

# Unified Release Layout

Ambos usarão:

```
DATA_DIR/
  releases/
    1.0.0/
    1.1.0/
  current -> releases/1.1.0
  previous -> releases/1.0.0
  release-state.json
  config.env
  bootstrap.env
  logs/
```

---

# Launcher Contract

launchers **nunca apontam para versão específica**.

Eles apontam sempre para:

```
DATA_DIR/current/
```

Exemplos:

Linux

```
/var/lib/container-tracker/run-supervisor.sh
```

Windows

```
%LOCALAPPDATA%\Programs\ContainerTrackerAgent\run-supervisor.ps1
```

launcher resolve `current/` e executa runtime.

---

# Update Model

Update flow:

1. fetch manifest
2. compare version
3. download bundle
4. verify checksum
5. extract to releases/<version>
6. mark target_version
7. drain running jobs
8. activate release
9. health check
10. commit or rollback

---

# Rollback Model

Rollback ocorre quando:

- runtime crash
- heartbeat missing
- health check failure

Rollback steps:

1. detect failure
2. activate previous
3. mark last_known_good
4. record failure_count

---

# Platform Adapter Layer

Diferenças entre ficam isoladas em:

```
apps/agent/src/platform/
  linux.adapter.ts
  windows.adapter.ts
```

Adapters implementam:

```
startRuntime()
stopRuntime()
restartRuntime()
resolvePaths()
extractBundle()
```

---

# Windows Specific Rules

Windows differences:

- Scheduled Task start
- Zip extraction
- LocalAppData paths

But **release system remains identical**.

Installer responsibilities:

- initial directory creation
- scheduled task registration
- runtime bootstrap

Installer **is not used for updates**.

---

# Consequences

Benefits:

- single release model
- single updater logic
- deterministic rollback
- simpler CI/CD
- fewer platform branches

Costs:

- small adapter layer
- supervisor required

---

# Result

Agent release system becomes **-agnostic** with minimal adapters.

```
Supervisor
   ↓
Release activation
   ↓
Runtime
```

---

END ADR