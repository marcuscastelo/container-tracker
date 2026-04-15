# Agent Platform Layout (Canonical)

This document defines the canonical filesystem layout for `apps/agent` and ownership boundaries.

## Canonical Layout

```text
DATA_DIR/
  releases/
    <version>/
  current -> releases/<version>
  previous -> releases/<version>
  release-state.json
  runtime-state.json
  config.env
  bootstrap.env
  logs/
  downloads/
  run/
```

## Ownership

- `apps/agent/src/platform/*`
  - Owns OS-specific behavior (Linux/Windows).
  - Owns path resolution through `PlatformAdapter.resolvePaths()`.
  - Owns platform link/pointer switching through:
    - `readSymlinkOrPointer()`
    - `switchCurrentRelease()`
- `apps/agent/src/state/*`
  - Owns persistence of state files.
  - Must not compute paths; only consumes `PlatformPaths`.
- `apps/agent/src/config/infrastructure/*`
  - Owns `config.env` / `bootstrap.env` file I/O.
  - Must not compute paths; only consumes `PlatformPaths`.
- Runtime, supervisor, updater, control, CLI
  - Consume resolved paths from `PlatformAdapter`.
  - Must not branch on OS directly.

## Public State Policy

- Linux default public-state directory: `DATA_DIR/run`
- `AGENT_PUBLIC_STATE_DIR` remains an explicit override.
