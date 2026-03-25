# Platform ESLint Plugin Parity Report

Date: 2026-03-25
Scope: compare removed consumer-local JSX lint plugin assets with the current `@marcuscastelo/eslint-plugin` and `@marcuscastelo/eslint-config` packages installed in Container Tracker.

## Executive Summary

There is no functional regression in the three generic JSX rules now owned by platform:

- `platform/no-iife-in-jsx`
- `platform/no-jsx-short-circuit`
- `platform/no-jsx-ternary`

The platform package is shorter mainly because it extracted shared logic into reusable files:

- rule registration lives in `src/index.js`
- JSX wrapper detection lives in `src/utils/jsx.js`
- RuleTester setup lives in `tests/_shared.mjs`

So the line reduction is mostly structural, not a loss of enforcement.

The one real gap found is test/integration rigor:

- the old consumer had a dedicated smoke path proving real config wiring for the JSX plugin
- the current platform package mostly proves rule logic through `RuleTester`
- the current platform tests still exercise rule IDs under the legacy alias `container-tracker/*`, not the consumer-facing alias `platform/*`

Because the platform repo cannot be edited from this workspace, Container Tracker now carries a local integration smoke as a safety net:

- `scripts/lint/platform-jsx-rules-smoke.mjs`

## Validation Performed In Consumer

- `pnpm exec eslint --print-config src/modules/process/ui/screens/DashboardScreen.tsx`
  - confirmed `platform/no-jsx-short-circuit`, `platform/no-jsx-ternary`, and `platform/no-iife-in-jsx`
- `pnpm exec eslint --print-config src/modules/process/application/useCases/getProcessList.ts`
  - confirmed app-specific boundary rules still remain local
- `pnpm run lint:platform:jsx-smoke`
  - passed
- `pnpm check`
  - passed when run by itself

Operational note:

- `pnpm run lint:platform:jsx-smoke` and `pnpm check` should not be run in parallel because the smoke creates a temporary fixture under `src/` during execution.

## Lost Lines Overview

Captured from the removed consumer-local implementation and compared with the current platform package.

### Legacy consumer-local source that was removed

- `scripts/eslint-plugin/eslint-plugin-container-tracker.mjs`: 178 lines
- `scripts/eslint-plugin/no-iife-in-jsx-error-smoke.mjs`: 73 lines
- `scripts/eslint-plugin/no-iife-in-jsx-error-smoke.shared.mjs`: 115 lines

Subtotal: 366 lines

### Legacy consumer-local tests that were removed

- `scripts/tests/eslint-plugin-container-tracker.test.mjs`: 190 lines
- `scripts/tests/eslint-plugin-container-tracker.no-jsx-short-circuit.test.mjs`: 143 lines
- `scripts/tests/eslint-plugin-container-tracker.no-jsx-ternary.test.mjs`: 152 lines
- `scripts/tests/no-iife-in-jsx-error-smoke.shared.test.mjs`: 79 lines

Subtotal: 564 lines

### Current platform package source

- `src/index.js`: 18 lines
- `src/rules/no-iife-in-jsx.js`: 27 lines
- `src/rules/no-jsx-short-circuit.js`: 40 lines
- `src/rules/no-jsx-ternary.js`: 39 lines
- `src/utils/jsx.js`: 63 lines

Subtotal: 187 lines

### Current platform package tests

- `tests/_shared.mjs`: 21 lines
- `tests/no-iife-in-jsx.test.mjs`: 122 lines
- `tests/no-jsx-short-circuit.test.mjs`: 88 lines
- `tests/no-jsx-ternary.test.mjs`: 94 lines

Subtotal: 325 lines

### Delta

- source delta: `366 -> 187` (`-179`)
- test delta: `564 -> 325` (`-239`)
- total delta: `930 -> 512` (`-418`)

Interpretation:

- this is not evidence of missing features by itself
- most of the reduction comes from de-duplication and extraction of shared helpers
- the meaningful loss is integration-style coverage, not rule logic

## Feature Parity Assessment

### 1. `no-iife-in-jsx`

Current platform rule:

- `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/src/rules/no-iife-in-jsx.js:14-25`

Assessment:

- still reports arrow-function IIFEs inside `JSXExpressionContainer`
- still reports function-expression IIFEs inside `JSXExpressionContainer`
- same enforcement intent as the removed consumer-local rule

Conclusion:

- feature parity preserved

### 2. `no-jsx-short-circuit`

Current platform rule:

- `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/src/rules/no-jsx-short-circuit.js:16-38`
- shared JSX detection:
  - `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/src/utils/jsx.js:1-63`

Assessment:

- still forbids `cond && <JSX />`
- still detects JSX nested behind wrappers such as:
  - `ParenthesizedExpression`
  - `TSNonNullExpression`
  - `TSAsExpression`
  - `TSTypeAssertion`
  - `TSSatisfiesExpression`
- still traverses conditional and logical shapes to catch wrapped JSX

Conclusion:

- feature parity preserved

### 3. `no-jsx-ternary`

Current platform rule:

- `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/src/rules/no-jsx-ternary.js:16-38`
- shared JSX detection:
  - `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/src/utils/jsx.js:1-63`

Assessment:

- still forbids JSX ternaries
- still catches JSX hidden behind TS wrappers and fragments
- logic is equivalent, just shared through `containsExplicitJsx`

Conclusion:

- feature parity preserved

## Rigidity Gaps Still Present In Platform

### Gap 1. Tests still use legacy rule IDs

Current shared harness:

- `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/tests/_shared.mjs:11-19`

Current tests:

- `tests/no-iife-in-jsx.test.mjs:11`
- `tests/no-jsx-short-circuit.test.mjs:12`
- `tests/no-jsx-ternary.test.mjs:11`

Problem:

- tests are registered under `container-tracker/*`
- consumer usage is now `platform/*`
- this means the package tests prove rule bodies, but not the public consumer-facing alias that matters in downstream repos

Recommended platform change:

- parameterize `createRuleTesterConfig` to accept the plugin alias, or switch it to `platform`
- update rule names in tests to `platform/no-iife-in-jsx`, `platform/no-jsx-short-circuit`, and `platform/no-jsx-ternary`

Priority: high

### Gap 2. No package-owned integration smoke for config wiring

Current platform config wiring:

- plugin registration:
  - `node_modules/.pnpm/@marcuscastelo+eslint-config@0.4.0_eslint@10.0.0_jiti@2.6.1__typescript@5.9.3/node_modules/@marcuscastelo/eslint-config/src/internal/ui/jsx-runtime.js:1-10`
- rule activation:
  - `node_modules/.pnpm/@marcuscastelo+eslint-config@0.4.0_eslint@10.0.0_jiti@2.6.1__typescript@5.9.3/node_modules/@marcuscastelo/eslint-config/src/internal/ui/jsx-rules.js:1-7`

Problem:

- the platform repo does not appear to ship a smoke that proves:
  - config loads plugin successfully
  - `platform/no-*` rule IDs resolve
  - severity levels match the intended contract

This is the main rigidity loss versus the old consumer-local setup.

Recommended platform change:

- add one integration smoke in the platform repo that lints a small `.tsx` fixture through the real flat config and asserts:
  - `platform/no-iife-in-jsx` is present
  - `platform/no-jsx-short-circuit` is present
  - `platform/no-jsx-ternary` is present
  - expected severities are preserved

Priority: high

### Gap 3. Package metadata still carries consumer naming

Current plugin metadata:

- `node_modules/.pnpm/@marcuscastelo+eslint-plugin@0.3.0/node_modules/@marcuscastelo/eslint-plugin/src/index.js:11-18`

Problem:

- exported constant is still named `containerTrackerEslintPlugin`
- `meta.name` is still `"container-tracker"`

This does not break enforcement, but it is a leftover consumer identity inside the platform package.

Recommended platform change:

- rename the exported constant to something platform-neutral
- change `meta.name` to match the package identity

Priority: medium

### Gap 4. One explicit valid no-IIFE case was dropped

Observation:

- the old consumer tests explicitly covered a function-expression IIFE outside JSX as a valid case
- the current platform tests already cover the same principle for arrow-IIFEs outside JSX, so the rule behavior is still safe
- the missing case is small, but restoring it would tighten regression confidence

Recommended platform change:

- add one extra valid test proving a function-expression IIFE outside JSX is allowed

Priority: low

## Consumer Compensation Added

Because platform cannot be edited from here, Container Tracker now has a local smoke:

- `scripts/lint/platform-jsx-rules-smoke.mjs:1-138`

What it proves:

- the installed `@marcuscastelo/eslint-config` loads the plugin
- `platform/no-iife-in-jsx`, `platform/no-jsx-short-circuit`, and `platform/no-jsx-ternary` all fire on a real `.tsx` fixture
- `platform/no-iife-in-jsx` can be promoted to error through override config

This restores the integration confidence that was previously provided by the old consumer-local smoke path.

## Final Recommendation For The Platform Repo

If opening a follow-up PR in the platform repo, the recommended order is:

1. fix test aliasing to use `platform/*`
2. add one package-owned integration smoke through the real config
3. rename plugin metadata away from `container-tracker`
4. optionally add the extra valid no-IIFE non-JSX case

## Bottom Line

- strictness of the three JSX rules is preserved
- simplification is mostly structural and healthy
- the only meaningful rigor regression is missing package-owned integration verification
- Container Tracker is currently protected by a local smoke until that upstream gap is closed
