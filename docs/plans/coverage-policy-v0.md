# Coverage Policy v0

## Purpose

Coverage Policy v0 gives architectural visibility over test protection without
turning global percentage into main quality signal.

policy is intended to answer:

- which bounded contexts are protected
- which architectural layers carry current confidence
- whether tracking critical semantics are visible first-class coverage concerns

## Official Scope

official global metric only includes these roots:

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

This keeps policy focused on runtime code owned by product architecture.

## What The Report Shows

`pnpm run coverage:report` produces:

1. global scoped coverage
2. coverage by module
3. coverage by layer
4. tracking-critical coverage
5. `unclassified` files, if any remain

same structure is written to:

- `coverage/coverage-policy-report.json`
- `coverage/coverage-policy-report.md`

`pnpm run coverage:baseline` updates versioned baseline in:

- `docs/plans/coverage-baseline.json`
- `docs/plans/coverage-baseline.md`

## Module Breakdown

report keeps module visibility explicit:

- `process`
- `container`
- `tracking`
- `capabilities`
- `shared`

This prevents `shared` or cheaper files from masking gaps in canonical
bounded contexts.

## Layer Breakdown

report also groups coverage by architectural layer:

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
report should reflect architecture, not invent new one.

## Unclassified

`unclassified` is diagnostic bucket.

It means file is inside official coverage scope but does not match any
explicit layer rule yet. In v0 this does not fail CI, but it is still policy
debt because it weakens architectural reading of report.

target for v0 is to keep `unclassified` at zero or near-zero with explicit,
auditable rules.

## Tracking-Critical Coverage

Coverage Policy v0 treats these tracking areas semantically critical:

- `observation`
- `series`
- `timeline`
- `status`
- `alerts`

Numeric coverage for those areas is reported by `coverage:report`.

Semantic coverage is tracked manually in:

- `docs/plans/coverage-tracking-critical-matrix.md`

matrix records:

- whether suite exists
- whether happy paths are covered
- whether edge cases are covered
- current suites
- visible gaps

## What v0 Does

- instruments coverage in Vitest
- publishes scoped report in CI
- keeps versioned baseline
- shows module and layer concentration
- highlights tracking-critical numeric coverage
- keeps manual semantic inventory for tracking critical paths

## What v0 Does Not Do

- enforce rigid global thresholds
- gate PRs by arbitrary percentage
- enforce changed-files coverage
- replace semantic review with coverage math
- justify architectural refactors only to please report

## Commands

- `pnpm run test:coverage`
- `pnpm run coverage:report`
- `pnpm run coverage:baseline`

Operational note:

- `pnpm run coverage:report` expects `coverage/vitest/coverage-final.json` to
exist, so run `pnpm run test:coverage` first when working locally.

## Related Artifacts

- `docs/plans/coverage-scope.json`
- `docs/plans/coverage-baseline.md`
- `docs/plans/coverage-tracking-critical-matrix.md`
