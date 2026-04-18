# no-iife-in-jsx Baseline

Generated at: 2026-03-03 07:22:57Z

## Scope
- Files: `src/modules/**/ui/**/*.{ts,tsx}`
- Rule: `container-tracker/no-iife-in-jsx`
- Severity: `warn`
- Command:
  - `pnpm exec eslint "src/modules/**/ui/**/*.{ts,tsx}" --format json`

## Baseline Summary
- Files scanned: `39`
- `no-iife-in-jsx` warnings: `0`

## Occurrences by File
- No current occurrences in scope.

## Incremental Refactoring Tasks
1. Keep rule in `warn` mode for `src/modules/**/ui/**/*.{ts,tsx}` while monitoring new warnings per PR.
2. If warning appears, refactor JSX IIFE usage into one of approved alternatives: pre-calculation before JSX, pure external function, or `createMemo`.
3. Re-generate this baseline after each refactor wave to track net warning reduction by file.
4. Promote `warn -> error` only when baseline remains at `0` warnings and CI expectations are updated.
5. Follow [the transition guide](./no-iife-in-jsx-transition.md) for promotion checklist, controlled exception format, and CI gate verification.
