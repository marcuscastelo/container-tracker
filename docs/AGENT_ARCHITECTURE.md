# Agent Architecture (Canonical)

Status: active
Scope: `apps/agent`

## Canonical root

- Runtime/build/release architecture for agent is defined under `apps/agent`.
- `tools/agent` references are legacy-only context in historical docs.

## Final tree

```text
apps/agent/src/
  app/
  core/
  config/
  release/
  runtime/
  sync/
  providers/
  state/
  observability/
  platform/
```

## Folder ownership

- `app/`: composition roots and entrypoints only.
- `core/`: contracts and shared pure types.
- `config/`: config parsing/validation and path layout resolution.
- `release/`: update-check, stage, activate, rollback.
- `runtime/`: process lifecycle, health gate, drain control.
- `sync/`: queue polling, execution orchestration, ack/failure reporting.
- `providers/`: provider-specific execution adapters (no orchestration ownership).
- `state/`: local file state mappers and repositories.
- `observability/`: heartbeat/health payload mapping and logging contracts.
- `platform/`: -specific branching and platform adapters.

## Explicit exceptions outside the tree

These are interface surfaces and are allowed:

- `apps/agent/src/cli/*`: operational CLI surface.
- `apps/agent/src/electron/*`: UI shell integration (IPC/main/preload).
- `apps/agent/src/installer/*`: installer/runtime host scripts.
- `apps/agent/src/build-release.ts` and `apps/agent/src/bundle-release.ts`: packaging/distribution entrypoints.

## Dependency rules

- `process.platform` branching is restricted to `apps/agent/src/platform/*`.
- `release/*` must not import `sync/*` or `providers/*`.
- `providers/*` must not import `sync/*` orchestration.
- `app/*` must not import operational policy from `*/domain/*`.
- Critical contracts are centralized in `apps/agent/src/core/contracts/*`.

Enforcement:

- ESLint restrictions in `eslint.config.mjs` (agent-specific blocks).
- Dedicated boundary gate: `pnpm run agent:boundary-scan` (covers `.cjs` too).

## Main pipeline

1. Supervisor (`app/agent.main.ts`) resolves layout, starts runtime, and controls release activation.
2. Runtime (`runtime/runtime.entry.ts`) runs sync cycles and heartbeat flow.
3. Sync orchestration (`sync/application/*`) leases work, executes providers, ingests raw payload, sends ack/failure.
4. Providers (`providers/*`) fetch raw payload and classify provider outcomes.
5. Release orchestration (`release/application/*`) checks manifest, stages artifact, requests drain, activates/rolls back.

## Update/rollback model

- Manifest contract is unified by `platforms`.
- No parallel updater runner path exists.
- Activation flow: `idle -> pending -> verifying -> idle|rolled_back|blocked`.
- Rollback triggers:
  - activation failure,
  - health-gate failure after activation,
  - release crash-loop threshold.
- Rollback target order:
  - last known good,
  - previous,
  - fallback bundled runtime version.

## Smoke commands

- `pnpm run agent:smoke:config-state`
- `pnpm run agent:smoke:platform`
- `pnpm run agent:smoke:release`
- `pnpm run agent:smoke:runtime`
- `pnpm run agent:smoke:sync`
- `pnpm run agent:smoke` (full smoke gate)

## Rollout model (canary -> stable)

Pre-rollout gates:

- mandatory close-out gate: `pnpm sanity` (baseline vs final, no regression), per `AGENTS.md` section `11.1`
- lint + boundary scans
- type-check
- tests
- smoke suites
- release build

Promotion criteria:

1. Publish canary.
2. Soak for 24h (default) with heartbeat/health/update/sync-provider monitoring.
3. Promote stable only with green soak.
4. Rollback via channel rollback workflow and post-rollback health/log/state validation.
