<!-- AUTO-GENERATED: canonical agent architecture map. Do not edit unless the architecture changes. -->
# Agent Architecture (Canonical)

Status: active
Scope: `apps/agent`

## Canonical Root

- Runtime, build, release, and control-UI architecture for the agent is defined under `apps/agent`.
- `tools/agent` references are historical only and should not be used as the primary reference for current code.

## Current Tree

```text
apps/agent/src/
  app/
  cli/
  config/
  control-core/
  core/
  electron/
  installer/
  observability.mapper.ts
  platform/
  providers/
  release/
  runtime/
  state/
  supervisor.ts
  sync/
```

## Folder Ownership

- `app/`: composition roots and entrypoints.
- `cli/`: operational CLI surface.
- `config/`: config parsing, validation, and path layout resolution.
- `control-core/`: public control snapshot/state helpers and control UI contracts.
- `core/`: shared contracts, pure types, and domain-independent errors.
- `electron/`: UI shell integration (IPC, main, preload, renderer glue).
- `installer/`: installer/runtime host scripts.
- `observability.mapper.ts`: heartbeat and health payload mapping.
- `platform/`: OS-specific branching and platform adapters.
- `providers/`: provider-specific execution adapters.
- `release/`: update-check, stage, activate, and rollback orchestration.
- `runtime/`: process lifecycle, health gate, and drain control.
- `state/`: local file-state mappers and repositories.
- `supervisor.ts`: top-level composition root.
- `sync/`: queue polling, execution orchestration, and ack/failure reporting.

## Boundary Rules

- `process.platform` branching stays inside `platform/*`.
- `release/*` must not import `sync/*` or `providers/*`.
- `providers/*` must not import sync orchestration.
- `app/*` and `supervisor.ts` only compose; they do not own policy.
- Critical contracts stay centralized in `core/contracts/*`.
- `control-core/*` may read public-state artifacts, but it must not reach into release/runtime internals directly.

Enforcement:

- ESLint restrictions in `eslint.config.mjs` for the agent layout.
- Dedicated boundary gate: `pnpm run agent:boundary-scan`.

## Main Pipeline

1. Supervisor (`app/agent.main.ts`) resolves layout, starts runtime, and wires release activation.
2. Runtime (`runtime/runtime.entry.ts`) runs sync cycles, heartbeat flow, and shutdown/drain handling.
3. Sync orchestration (`sync/application/*`) leases work, selects provider runners, ingests raw payload, and reports ack/failure.
4. Providers (`providers/*`) fetch raw payload and classify provider outcomes.
5. Release orchestration (`release/application/*`) checks manifest, stages artifacts, requests drain, and activates or rolls back.

## Update And Rollback Model

- Release manifest contract is centralized in `core/contracts/release-manifest.contract.ts` and `release/release-manifest.ts`.
- There is no parallel updater runner path.
- Activation flow: `idle -> pending -> verifying -> idle|rolled_back|blocked`.
- Rollback triggers:
  - activation failure
  - health-gate failure after activation
  - release crash-loop threshold
- Rollback target order:
  - last known good
  - previous
  - fallback bundled runtime version

## Smoke Commands

- `pnpm run agent:smoke:config-state`
- `pnpm run agent:smoke:platform`
- `pnpm run agent:smoke:release`
- `pnpm run agent:smoke:runtime`
- `pnpm run agent:smoke:sync`
- `pnpm run agent:smoke`

## Rollout Model

Pre-rollout gates:

- mandatory close-out gate: `pnpm sanity` with no regression
- lint and boundary scans
- type-check
- tests
- smoke suites
- release build

Promotion criteria:

1. Publish canary.
2. Soak for 24h by default with heartbeat, health, update, and sync-provider monitoring.
3. Promote stable only with a green soak.
4. Roll back through the channel rollback workflow and validate health, logs, and state afterward.

## Historical Audit Notes

This file previously carried a much larger code-first inventory. The core findings still matter and are retained here in shorter form:

- The agent runtime bootstraps through the backend, persists local config, and then runs a scheduler-driven sync loop.
- Provider fetches happen in the agent, while the server stays responsible for leasing, ingestion, normalization, derivation, and read-model responses.
- Runtime state and activity are persisted separately from sync payloads.
- Realtime wake is optional and only accelerates the same queue-backed flow.
- The old `tools/agent` path is historical context only; the current implementation surface lives under `apps/agent`.
- A separate updater runner is not wired as a parallel runtime entrypoint; release behavior is centralized in `release/*`.

If a future audit needs the exhaustive file-by-file map again, regenerate it from the current `apps/agent` tree rather than reviving the legacy `tools/agent` paths.
