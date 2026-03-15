# Feature Issue — Carrier Resolution (AUTO / MANUAL) + Auto Detection + UI Integration

Status: Proposed  
Owner: Sync Capability  
Affected Modules:
- `process`
- `container`
- `capabilities/sync`
- UI (dashboard / process screen / create dialog)

Priority: High (foundation for reliable sync)

---

# TLDR

This issue implements **robust carrier resolution** with **automatic carrier detection**, while preserving user intent and avoiding operational deadlocks.

Key principles:

```
Container = truth of carrier
Process = default strategy / hint
Process UI carrier = derived summary
```

Two modes exist for a process:

```
AUTO
MANUAL
```

But **containers default to AUTO**, even if the process was created manually.

This allows the system to **self-heal user mistakes** while respecting explicit manual overrides.

Detection is triggered when:

```
sync → NOT_FOUND
```

Detection:

```
tries multiple carriers
finds the correct one
updates container
optionally updates process default
```

Processes can become:

```
UNKNOWN
SINGLE carrier
MIXED carriers
```

Important rule:

```
MIXED does NOT halt the system
```

It only disables **batch propagation**.

Everything else continues normally.

---

# Why This Feature Exists

Users frequently create processes with the wrong carrier.

Example:

```
Container: CMAU1945069
Selected carrier: MSC
Real carrier: CMA CGM
```

Result today:

```
sync fails
user confused
manual correction required
```

Desired behavior:

```
sync fails
system detects CMA CGM
container corrected automatically
sync continues
```

This feature makes the system **resilient to human error**.

---

# Core Architectural Principle

Carrier truth **must not live on the process**.

The correct architecture is:

```
container.carrierCode = truth
process.defaultCarrierCode = hint
process carrier UI = derived
```

Reason:

- containers can legitimately belong to different carriers
- processes may become heterogeneous
- UI must not invent domain truth

This preserves determinism and auditability.

---

# Domain Model

## Container

Canonical carrier owner.

```
container.carrierCode
container.carrierAssignmentMode
container.carrierDetectedAt
container.carrierDetectionSource
```

### carrierAssignmentMode

Values:

```
AUTO
MANUAL
```

Meaning:

AUTO

```
carrier can be corrected automatically
```

MANUAL

```
carrier explicitly fixed by user
must never be overridden automatically
```

---

## Process

Carrier strategy only.

```
process.carrierMode
process.defaultCarrierCode
process.lastResolvedCarrierCode
process.carrierResolvedAt
```

### carrierMode

Values:

```
AUTO
MANUAL
```

Meaning:

AUTO

```
process default carrier may change automatically
```

MANUAL

```
process default carrier chosen by user
system should not automatically promote a new process carrier
```

Important:

```
process.MANUAL DOES NOT imply container.MANUAL
```

Containers remain AUTO unless explicitly fixed.

---

# Process Creation Semantics

## Case 1 — User selects carrier

UI:

```
Carrier: MSC
```

Result:

```
process.carrierMode = MANUAL
process.defaultCarrierCode = MSC
```

Containers created:

```
carrierCode = MSC
carrierAssignmentMode = AUTO
carrierDetectionSource = process-seed
```

Why?

User intent:

```
I think this is MSC
```

But the system must allow recovery if wrong.

---

## Case 2 — Carrier unknown

UI:

```
Carrier: Unknown
```

Result:

```
process.carrierMode = AUTO
process.defaultCarrierCode = null
```

Containers:

```
carrierCode = null
carrierAssignmentMode = AUTO
```

Carrier will be detected during sync.

---

# Sync Execution Flow

## Normal Success

```
sync(container)
→ provider lookup
→ FOUND
→ ingest events
```

No detection triggered.

---

## Sync Failure Eligible for Detection

Only trigger detection when:

```
error = CONTAINER_NOT_FOUND
```

Never trigger detection for:

```
429 rate limit
timeout
authentication error
provider downtime
parse errors
agent failure
```

These are operational errors.

---

# Detection Workflow

Detection is **process-scoped**, not container-scoped.

Reason:

```
avoid N × carrier probes
coordinate multiple agents
propagate useful discoveries
```

Workflow:

```
sync fails
↓
open detection run
↓
providers distributed among agents
↓
agents probe carriers
↓
first successful provider wins
↓
process + containers updated
↓
sync retried
```

Example:

```
carriers: MSC / MAERSK / CMA
3 agents
```

Distribution:

```
agent1 → MSC
agent2 → MAERSK
agent3 → CMA
```

As soon as one finds the container:

```
stop probing
update system
retry sync
```

---

# Promotion Rules

When detection succeeds:

Allowed:

```
update container carrier
update process default carrier
update other AUTO containers
```

Blocked if:

```
containerAssignmentMode = MANUAL
process becomes heterogeneous
confidence too low
```

---

# Heterogeneous Processes

Processes may become heterogeneous.

Example:

```
container1 → MSC
container2 → CMA
container3 → MSC
```

Derived summary:

```
MIXED
```

Important rule:

```
MIXED ≠ halt
```

System behavior:

```
stop batch propagation
continue container resolution
```

Detection continues normally.

---

# Convergence

Processes may converge later.

Example:

Run 1

```
c1 → CMA
c2 → MSC
summary = MIXED
```

Run 2

```
c1 → MSC
c2 → MSC
c3 → MSC
summary → SINGLE MSC
```

MIXED is not terminal.

---

# Derived Process Carrier Summary

Backend must compute:

```
EffectiveCarrierSummary
```

Types:

```
UNKNOWN
SINGLE
MIXED
```

### UNKNOWN

No container has carrier yet.

### SINGLE

All containers share same carrier.

### MIXED

Containers have different carriers.

---

# UI Impact

Three screens affected.

```
Create Process dialog
Process screen
Dashboard
```

---

# Create Process Dialog

Current UI:

Carrier dropdown:

```
Maersk
MSC
CMA CGM
Unknown
```

New semantics:

| selection      | result         |
| -------------- | -------------- |
| Carrier chosen | process.MANUAL |
| Unknown        | process.AUTO   |

Helper text recommended:

Carrier selected:

```
Carrier will be used as default.
Containers may still auto-correct if not found.
```

Unknown:

```
Carrier will be detected automatically during sync.
```

---

# Process Screen

Must display:

```
Carrier
Mode
Effective carrier summary
```

Examples:

Manual process:

```
Carrier: MSC
Mode: Manual
```

Auto process:

```
Carrier: Auto
```

Mixed process:

```
Effective carriers: Mixed (MSC, CMA CGM)
```

---

# Detection Feedback

When container corrected:

Toast:

```
Carrier detected for container CMAU1945069: CMA CGM
```

If process updated:

```
Process carrier updated to CMA CGM
```

---

# Mixed Process UI

Banner:

```
Containers use different carriers.
Automatic batch updates are paused.
```

Actions:

```
Normalize AUTO containers
Review containers
Keep mixed
```

---

# Container Grid

Each container card may show:

```
carrier badge
assignment mode
```

Example:

```
MSC
AUTO
```

or

```
CMA CGM
MANUAL
```

---

# Dashboard

Current table shows:

```
Process | Carrier
```

New behavior:

Display **effective carrier summary**, not process default.

Examples:

```
MSC
Mixed
MSC +1
```

Filters must operate on **container carriers**, not process defaults.

---

# Example User Flows

## Scenario 1 — Correct carrier

User selects:

```
MSC
```

Containers are MSC.

```
sync → success
```

No detection.

---

## Scenario 2 — Wrong carrier

User selects:

```
MSC
```

Containers actually:

```
CMA CGM
```

Flow:

```
sync
↓
not found
↓
detection
↓
carrier found: CMA
↓
container corrected
↓
process default updated
↓
sync continues
```

---

## Scenario 3 — Unknown carrier

User selects:

```
Unknown
```

Flow:

```
sync
↓
detection
↓
carrier found
↓
process updated
```

---

## Scenario 4 — Mixed carriers

Containers:

```
MSC
CMA
MSC
```

Summary:

```
Mixed
```

System:

```
stop batch propagation
continue per-container sync
```

User may normalize.

---

# Manual Containers

Containers become MANUAL only when:

```
user explicitly fixes carrier
```

Then:

```
automation cannot overwrite
```

---

# Metrics

Track:

```
carrier_detection_runs
carrier_detection_success
carrier_detection_latency
carrier_detection_mixed
```

---

# Required Tests

Must cover:

```
process AUTO creation
process MANUAL creation
container seeded from process
sync success
sync fail detection
promotion rules
container MANUAL protection
heterogeneous process
mixed convergence
dashboard summary correctness
```

---

# Final Design Decision

Carrier resolution architecture:

```
container = source of truth
process = strategy
UI = derived summary
```

Detection:

```
sync → fail → detect → correct → retry
```

Heterogeneous state:

```
allowed
non-blocking
recoverable
```

System becomes:

```
resilient
self-healing
deterministic
```

---

# Expected Outcome

After implementation:

```
wrong carriers auto-correct
sync failures drop dramatically
users rarely need manual correction
system becomes robust against human error
```