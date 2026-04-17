# Container Tracker

Operational maritime tracking platform focused on **domain consistency, auditability, and exception visibility**.

---

## TLDR

Container Tracker is an **event-driven maritime tracking system**.

- Ingests carrier data as immutable snapshots  
- Converts them into normalized observations (facts)  
- Derives timeline, status, and alerts deterministically  
- Preserves full history (append-only, audit-safe)  
- Exposes uncertainty and conflicts instead of hiding them  

```
Snapshot → Observation → Timeline → Status → Alerts
```

- `tracking` owns domain truth  
- UI only renders (never derives)  
- Status is computed, not stored  

> The system does not guess state — it explains it.

---

## Screenshots

### Desktop

<img width="1904" height="1020" alt="image" src="https://github.com/user-attachments/assets/9907ff8c-941f-4187-8736-f45c136d03c0" />
<img width="1904" height="1985" alt="image" src="https://github.com/user-attachments/assets/5a168dac-8028-43af-af84-90120c36887a" />

---

# How an operator uses it

1. Search a shipment by reference or container
2. See automatically derived status (no manual reconciliation)
3. Inspect timeline (ACTUAL vs EXPECTED + changes)
4. Act on alerts (delays, conflicts, missing updates)
5. Audit full history (raw carrier snapshots preserved)

---

# Technical overview

## Architecture

- Bounded Contexts (`src/modules/*`)
  - `process` → shipment grouping
  - `container` → container identity
  - `tracking` → domain truth (timeline, status, alerts)

- `capabilities/*` → orchestration (no domain semantics)

## Rules

- Domain does not depend on UI or HTTP
- UI never derives domain truth
- No cross-BC domain imports

---

## ACTUAL vs EXPECTED

Events can be:

- **ACTUAL** → confirmed event  
- **EXPECTED** → carrier prediction  

The system:

- preserves all predictions
- selects a primary event (safe-first)
- marks expired expectations
- never hides inconsistencies

---

## UI golden rule

The UI:

- renders timeline, status, alerts

The UI **does NOT**:

- derive status
- interpret events
- recompute timeline
- resolve conflicts

---

# Stack

- Node.js `>= 22`
- TypeScript
- SolidStart / SolidJS (Vinxi)
- Zod
- Vitest
- Biome + ESLint

---

# Installation

```bash
pnpm install
pnpm run dev
```

## Supabase local-only

Fluxo operacional local de `staging` compartilhado + `dev` emancipada por worktree:
- [docs/dev/supabase-local.md](docs/dev/supabase-local.md)
- [docs/dev/supabase-worktrees-local.md](docs/dev/supabase-worktrees-local.md)

Comandos principais:

```bash
pnpm initialize-worktree
pnpm db:emancipate
pnpm db:rejoin
pnpm destroy-worktree
```

---

# Scripts

```bash
pnpm run build
pnpm run start
pnpm run test
pnpm run type-check
pnpm run lint
pnpm run check
pnpm run i18n:check
pnpm run maersk:smoke:puppeteer
```

---

# Devcontainer smoke (Puppeteer)

```bash
pnpm run maersk:smoke:puppeteer
```

Expected:

```
[maersk-smoke] PASS
```

---

# Code structure

```
src/
  modules/
  capabilities/
  routes/
  shared/
```

---

# Core principle

States are derived from events.  
Events are derived from snapshots.  
Snapshots are never discarded.
