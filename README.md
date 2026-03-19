# Container Tracker

Operational maritime tracking platform focused on **domain consistency, auditability, and exception visibility**.

## TLDR

Container Tracker is an **event-driven maritime tracking system**.

- Ingests carrier data as immutable snapshots  
- Converts them into normalized observations (facts)  
- Derives timeline, status, and alerts deterministically  
- Preserves full history (append-only, audit-safe)  
- Exposes uncertainty and conflicts instead of hiding them  

**Key idea:**

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

# Phase 1: How an operator uses it

1. Opens the dashboard and searches for a shipment by reference or container number.
2. Sees the current status automatically derived (e.g. in transit, discharged, delivered) without manually reconciling multiple carriers.
3. Reads the timeline to understand what actually happened (ACTUAL) and what was predicted (EXPECTED), including changes over time.
4. Receives operational alerts to act early on delays, inconsistencies, or missing updates.
5. Uses the preserved history for audit: every change is traceable back to the original carrier snapshot.

---

# Phase 2: How it works (plain language)

1. The system collects updates from different carriers.
2. Each raw update is stored exactly as received (never overwritten).
3. These updates are converted into standardized facts (observations).
4. From these facts, the system derives timeline, status, and alerts.
5. If there is uncertainty or conflict, it is explicitly shown instead of hidden.

**Summary:** the system does not “guess” state.  
It derives state from real events and preserves full history to explain any outcome.

---

# Phase 3: Technical pitch + setup

## Why the architecture works

- Clear Bounded Contexts in `src/modules/*`:
  - `process`: shipment grouping and operational context
  - `container`: container identity and association
  - `tracking`: snapshots, observations, and all derivations (timeline, status, alerts)

- Capabilities in `src/capabilities/*` orchestrate cross-context flows without owning domain semantics.

- Strict dependency rules:
  - modules do not depend on capabilities
  - domain does not depend on UI or HTTP
  - UI never defines domain truth

- Strong tracking invariants:
  - snapshots are immutable
  - observations are append-only
  - status is always derived
  - conflicts and uncertainty are exposed

---

## Operational principles

- History is preserved (append-only)
- No data is overwritten or deleted
- Status is always derived, never stored as truth
- Conflicts and inconsistencies are exposed, not hidden
- The full timeline is the primary source of understanding

The system prioritizes **correctness and explainability over visual simplification**.

---

## Canonical tracking pipeline

```
Carrier API
   ↓
Snapshot (immutable)
   ↓
Observation (normalized fact)
   ↓
Timeline (derived)
   ↓
Status (derived)
   ↓
Alerts (derived)
```

This pipeline is deterministic and reproducible.

---

## ACTUAL vs EXPECTED

Events can be:

- **ACTUAL** → confirmed real-world event  
- **EXPECTED** → carrier prediction

The system:

- preserves all historical predictions
- selects a single “primary” event using a safe-first rule
- marks expired predictions
- never removes inconsistencies

This makes it possible to understand **how predictions evolved over time**.

---

## UI golden rule

The UI:

- renders timeline, status, and alerts
- formats and organizes information

The UI **does NOT**:

- derive status
- interpret events
- recalculate timeline
- resolve conflicts

All domain semantics belong to the `tracking` context.

---

## TLDR architecture

- `tracking` → domain truth (timeline, status, alerts)
- `process` → operational grouping
- `container` → physical identity
- `capabilities` → orchestration layer
- UI → presentation only

Each boundary changes the type:

```
Row → Entity → Result → DTO → ViewModel
```

---

# Stack

- Node.js `>= 22`
- TypeScript
- SolidStart / SolidJS (Vinxi)
- Zod (validation)
- Vitest (testing)
- Biome + ESLint (code quality)

---

# Installation

```bash
pnpm install
pnpm run dev
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

# Puppeteer Smoke Test (devcontainer)

```bash
pnpm run maersk:smoke:puppeteer
```

Expected output:

```
[maersk-smoke] PASS
```

Failure classifications:

- `missing_browser_binary`
- `invalid_chrome_path`
- `launch_incompatibility`

---

# API Smoke Test (`/api/refresh-maersk/:container`)

```bash
CONTAINER=MRKU1234567
curl -sS "http://localhost:3000/api/refresh-maersk/${CONTAINER}?headless=1&hold=0&timeout=70000" \
  | tee /tmp/maersk-refresh-smoke.json
```

```bash
if grep -q "Browser launch failed" /tmp/maersk-refresh-smoke.json; then
  echo "FAIL: browser launch still blocking"
else
  echo "PASS: browser launch is not the blocker"
fi
```

Rules:

- Must not contain `Browser launch failed`
- Provider errors (403, 502, etc.) do not fail this test

---

# Chromium Version Policy (devcontainer)

- Controlled via `.devcontainer/devcontainer.json`
- Installed via Dockerfile with version pinning
- No automatic updates

### Manual bump process

```bash
apt-cache madison chromium
```

1. Update version in devcontainer config
2. Open PR
3. Rebuild container
4. Validate:

```bash
pnpm run maersk:smoke:puppeteer
pnpm run check
```

---

# Code structure

```
src/
  modules/       # bounded contexts (source of truth)
  capabilities/  # cross-context orchestration
  routes/        # thin adapters
  shared/        # infra and utilities
```

---

# Core principle

States are derived from events.  
Events are derived from snapshots.  
Snapshots are never discarded.

---

# Summary

Container Tracker is:

- event-driven
- append-only
- deterministic
- audit-first
- timeline-first

> The domain defines truth.  
> The UI exposes it.  
> Nothing else is allowed to reinterpret it.
