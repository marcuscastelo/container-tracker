# no-iife-in-jsx Transition Guide

This guide defines controlled promotion path from `warn` to `error` for `container-tracker/no-iife-in-jsx`.

## Promotion Precondition

Promotion to `error` is allowed only when all items below are true:

1. Baseline at [@@H0@@](./no-iife-in-jsx-baseline.md) reports `0` warnings.
2. Scoped lint command still reports `0` warnings for rule:
   - `pnpm exec eslint "src/modules/**/ui/**/*.{ts,tsx}" --format json`
3. New PRs in scope do not introduce warnings for `container-tracker/no-iife-in-jsx`.

## Controlled Exception Format

Use inline disable only when refactor cannot be completed in same PR and always include justified reason.

```tsx
// eslint-disable-next-line container-tracker/no-iife-in-jsx -- justified reason: <ticket/context>
{(() => computeFallback())()}
```

## warn -> error Procedure

1. Confirm precondition above (`0` warnings in scope).
2. Change rule severity in [@@H0@@](../../eslint.config.mjs) for `src/modules/**/ui/**/*.{ts,tsx}`:
   - from: `'container-tracker/no-iife-in-jsx': 'warn'`
   - to: `'container-tracker/no-iife-in-jsx': 'error'`
3. Run local quality gate:
   - `pnpm run lint`
   - `pnpm run type-check`
   - `pnpm run test`
4. Ensure CI quality gate stays green (`lint`, `type-check`, `test`).
5. Remove temporary disables soon blocking context is resolved.

## CI Gate Proof for Error Promotion

Quality workflow includes `pnpm run lint:no-iife:error-smoke`, which:

1. Generates temporary UI fixture containing IIFE in JSX.
2. Runs ESLint with `--rule '{"container-tracker/no-iife-in-jsx":"error"}'`.
3. Expects lint command to fail because of sample violation.

If lint does not fail under error severity, smoke command fails and CI lint job is blocked.
