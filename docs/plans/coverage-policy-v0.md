# Coverage Policy v0

## Purpose

Coverage Policy v0 gives architectural visibility over test protection without
turning global percentage into the main quality signal.

The policy is intended to answer:

- which bounded contexts are actually protected
- which architectural layers carry the current confidence
- whether tracking critical semantics are visible as first-class coverage concerns

## Official Scope

The official global metric only includes these roots:

- `src/modules/process/**`
- `src/modules/container/**`
- `src/modules/tracking/**`
- `src/capabilities/**`
- `src/shared/**`

Explicit exclusions in v0:

- `**/tests/**`
- `**/*.test.*`
- `**/fixtures/**`
- `src/modules/tracking/dev/**`

This keeps the policy focused on runtime code owned by the product architecture.

## What The Report Shows

`pnpm run coverage:report` produces:

1. global scoped coverage
2. coverage by module
3. coverage by layer
4. tracking-critical coverage
5. `unclassified` files, if any remain

The same structure is written to:

- `coverage/coverage-policy-report.json`
- `coverage/coverage-policy-report.md`

`pnpm run coverage:baseline` updates the versioned baseline in:

- `docs/plans/coverage-baseline.json`
- `docs/plans/coverage-baseline.md`

## Module Breakdown

The report keeps module visibility explicit:

- `process`
- `container`
- `tracking`
- `capabilities`
- `shared`

This prevents `shared` or cheaper files from masking gaps in the canonical
bounded contexts.

## Layer Breakdown

The report also groups coverage by architectural layer:

- `domain`
- `application`
- `infrastructure`
- `interface/http`
- `ui`

Classification follows canonical directory segments first:

- `/domain/`
- `/application/`
- `/infrastructure/`
- `/interface/http/`
- `/ui/`

Shared and presenter files that live outside those canonical paths are assigned
through explicit rules in `docs/plans/coverage-scope.json`. This is intentional:
the report should reflect the architecture, not invent a new one.

## Unclassified

`unclassified` is a diagnostic bucket.

It means a file is inside the official coverage scope but does not match any
explicit layer rule yet. In v0 this does not fail CI, but it is still policy
debt because it weakens the architectural reading of the report.

The target for v0 is to keep `unclassified` at zero or near-zero with explicit,
auditable rules.

## Tracking-Critical Coverage

Coverage Policy v0 treats these tracking areas as semantically critical:

- `observation`
- `series`
- `timeline`
- `status`
- `alerts`

Numeric coverage for those areas is reported by `coverage:report`.

Semantic coverage is tracked manually in:

- `docs/plans/coverage-tracking-critical-matrix.md`

The matrix records:

- whether a suite exists
- whether happy paths are covered
- whether edge cases are covered
- current suites
- visible gaps

## What v0 Does

- instruments coverage in Vitest
- publishes a scoped report in CI
- keeps a versioned baseline
- shows module and layer concentration
- highlights tracking-critical numeric coverage
- keeps a manual semantic inventory for tracking critical paths

## What v0 Does Not Do

- enforce rigid global thresholds
- gate PRs by arbitrary percentage
- enforce changed-files coverage
- replace semantic review with coverage math
- justify architectural refactors only to please the report

## Commands

- `pnpm run test:coverage`
- `pnpm run coverage:report`
- `pnpm run coverage:baseline`

## Related Artifacts

- `docs/plans/coverage-scope.json`
- `docs/plans/coverage-baseline.md`
- `docs/plans/coverage-tracking-critical-matrix.md`
