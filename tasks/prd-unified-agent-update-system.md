# PRD — Unified Agent Update System

Goal:

Implement a **fully unified release and update system** for the agent runtime across Linux and Windows.

Requirements:

- identical release structure
- deterministic activation
- automatic rollback
- CI/CD driven updates
- channel support (stable/canary)
- zero mocks
- production-ready

---

# Release Artifact

Each release bundle contains:

```
agent/
supervisor/
updater/
manifest.json
VERSION
```

Artifact name:

```
agent-bundle-<version>-<platform>.tar.gz
agent-bundle-<version>-windows-x64.zip
```

---

# Manifest Contract

```
{
  "channel": "stable",
  "version": "1.4.0",
  "platforms": {
    "linux-x64": {
      "url": "...",
      "checksum": "..."
    },
    "windows-x64": {
      "url": "...",
      "checksum": "..."
    }
  }
}
```

---

# Data Directory Layout

```
DATA_DIR/
  releases/
  current
  previous
  release-state.json
  config.env
  bootstrap.env
```

---

# Release State

```
{
  "current_version": "1.3.0",
  "target_version": "1.4.0",
  "last_known_good_version": "1.3.0",
  "activation_state": "idle",
  "failure_count": 0
}
```

---

# Supervisor Responsibilities

Supervisor runs continuously.

Responsibilities:

- spawn runtime
- watch runtime
- coordinate updates
- rollback on failure

---

# Activation Flow

```
check manifest
  ↓
download bundle
  ↓
verify checksum
  ↓
extract releases/<version>
  ↓
mark target_version
  ↓
drain runtime
  ↓
switch current symlink
  ↓
restart runtime
  ↓
health gate
  ↓
commit
```

---

# Health Gate

Release considered healthy if:

- heartbeat received
- runtime started successfully
- no crash within grace period

Failure triggers rollback.

---

# Rollback Flow

```
detect failure
  ↓
activate previous
  ↓
restart runtime
  ↓
record rollback
```

---

# Update Channels

Agents can run:

```
stable
canary
```

Channel stored in config.env.

---

# Installer Responsibilities (Windows Only)

Installer performs:

- create directories
- copy runtime
- create scheduled tasks
- create launcher

Installer **does not manage updates**.

---

# Acceptance Criteria

The system is considered complete when:

- agent updates successfully on Linux
- agent updates successfully on Windows
- rollback works
- supervisor survives runtime crash
- CI produces release bundles
- channel switching works

---

END PRD