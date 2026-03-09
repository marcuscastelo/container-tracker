# Refactor Baseline Snapshot (features reorg)

Date: 2026-03-09
Branch: refactor/subdomains
Base commit: a8adbf0

## Scope tree snapshot (pre-move)

### `src/modules/tracking` directories (maxdepth 4)

```txt
src/modules/tracking
src/modules/tracking/application
src/modules/tracking/application/orchestration
src/modules/tracking/application/ports
src/modules/tracking/application/projection
src/modules/tracking/application/projection/tests
src/modules/tracking/application/tests
src/modules/tracking/application/usecases
src/modules/tracking/application/usecases/tests
src/modules/tracking/domain
src/modules/tracking/domain/derive
src/modules/tracking/domain/identity
src/modules/tracking/domain/logistics
src/modules/tracking/domain/model
src/modules/tracking/domain/reconcile
src/modules/tracking/domain/reconcile/tests
src/modules/tracking/domain/tests
src/modules/tracking/infrastructure
src/modules/tracking/infrastructure/bootstrap
src/modules/tracking/infrastructure/carriers
src/modules/tracking/infrastructure/carriers/fetchers
src/modules/tracking/infrastructure/carriers/normalizers
src/modules/tracking/infrastructure/carriers/schemas
src/modules/tracking/infrastructure/carriers/schemas/api
src/modules/tracking/infrastructure/carriers/tests
src/modules/tracking/infrastructure/carriers/tests/fixtures
src/modules/tracking/infrastructure/persistence
src/modules/tracking/interface
src/modules/tracking/interface/http
src/modules/tracking/interface/http/tests
```

### `src/modules/process` directories (maxdepth 4)

```txt
src/modules/process
src/modules/process/application
src/modules/process/application/operational-projection
src/modules/process/application/operational-projection/tests
src/modules/process/application/usecases
src/modules/process/application/usecases/tests
src/modules/process/domain
src/modules/process/domain/identity
src/modules/process/infrastructure
src/modules/process/infrastructure/bootstrap
src/modules/process/infrastructure/persistence
src/modules/process/interface
src/modules/process/interface/http
src/modules/process/interface/http/tests
src/modules/process/ui
src/modules/process/ui/api
src/modules/process/ui/api/tests
src/modules/process/ui/components
src/modules/process/ui/components/tests
src/modules/process/ui/components/unified
src/modules/process/ui/hooks
src/modules/process/ui/hooks/tests
src/modules/process/ui/mappers
src/modules/process/ui/mappers/tests
src/modules/process/ui/screens
src/modules/process/ui/telemetry
src/modules/process/ui/telemetry/tests
src/modules/process/ui/tests
src/modules/process/ui/timeline
src/modules/process/ui/timeline/tests
src/modules/process/ui/utils
src/modules/process/ui/utils/tests
src/modules/process/ui/validation
src/modules/process/ui/validation/tests
src/modules/process/ui/viewmodels
src/modules/process/ui/viewmodels/tests
```

## Baseline checks

- `pnpm run lint`: PASS
- `pnpm run type-check`: PASS
- `pnpm run test`: PASS (`102` test files, `677` tests)

## Notes

- No code files moved in this phase.
- This file records the baseline required before structural refactor phases.
