# no-iife-in-jsx Transition Guide

This guide defines the controlled promotion path from `warn` to `error` for `container-tracker/no-iife-in-jsx`.

## Promotion Precondition

Promotion to `error` is allowed only when all items below are true:

1. Baseline at [`docs/lint/no-iife-in-jsx-baseline.md`](./no-iife-in-jsx-baseline.md) reports `0` warnings.
2. Scoped lint command still reports `0` warnings for the rule:
   - `pnpm exec eslint "src/modules/**/ui/**/*.{ts,tsx}" --format json`
3. New PRs in scope do not introduce warnings for `container-tracker/no-iife-in-jsx`.

## Controlled Exception Format

Use an inline disable only when the refactor cannot be completed in the same PR and always include a justified reason.

```tsx
// eslint-disable-next-line container-tracker/no-iife-in-jsx -- justified reason: <ticket/context>
{(() => computeFallback())()}
```

Short form reference used in rollout docs:

```tsx
// eslint-disable-next-line no-iife-in-jsx -- justified reason
```

## warn -> error Procedure

1. Confirm the precondition above (`0` warnings in scope).
2. Change rule severity in [`eslint.config.mjs`](../../eslint.config.mjs) for `src/modules/**/ui/**/*.{ts,tsx}`:
   - from: `'container-tracker/no-iife-in-jsx': 'warn'`
   - to: `'container-tracker/no-iife-in-jsx': 'error'`
3. Run local quality gate:
   - `pnpm run lint`
   - `pnpm run type-check`
   - `pnpm run test`
4. Ensure CI quality gate stays green (`lint`, `type-check`, `test`).
5. Remove temporary disables as soon as the blocking context is resolved.

## CI Gate Proof for Error Promotion

Quality workflow includes `pnpm run lint:no-iife:error-smoke`, which:

1. Generates a temporary UI fixture containing an IIFE in JSX.
2. Runs ESLint with `--rule container-tracker/no-iife-in-jsx:error`.
3. Expects the lint command to fail because of the sample violation.

If lint does not fail under error severity, the smoke command fails and the CI lint job is blocked.
