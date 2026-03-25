# Scripts

## dev
- `dev.sh` - local dev server bootstrap. Future destination: `dev-tools`

## reports
- `gen-code-report.sh` - generates the code report used in architecture reviews. Future destination: `dev-tools`

## codemods
- `convert-relative-imports.js` - converts relative imports to repo-aligned paths. Future destination: `dev-tools`
- `convert-relative-imports.cjs` - CommonJS entry for the relative import codemod. Future destination: `dev-tools`
- `remove-type-assertions.js` - removes type assertions from supported source files. Future destination: `dev-tools`
- `remove-type-assertions.cjs` - CommonJS entry for the type-assertion codemod. Future destination: `dev-tools`

## lint
- `architecture-boundary-scan.mjs` - scans for architectural boundary violations. Future destination: `eslint-config`
- `check-i18n-keys.mjs` - checks that translation keys exist in locale files. Future destination: `dev-tools`
- `check-no-emoji.mjs` - flags decorative emoji or symbol characters in source. Future destination: `eslint-config`
- `enforce-i18n-no-hardcoded.mjs` - CI enforcement for hardcoded user-facing strings. Future destination: `eslint-config`
- `ui-complexity-allowlist-check.mjs` - validates the UI complexity allowlist against current scope. Future destination: `dev-tools`
- `ui-complexity-report.mjs` - produces the UI complexity baseline/report. Future destination: `dev-tools`
- `ui-complexity.shared.mjs` - shared helpers for UI complexity analysis. Future destination: `dev-tools`

## eslint-plugin
- `eslint-plugin-container-tracker.mjs` - internal ESLint plugin for repo-specific rules. Future destination: `eslint-plugin`
- `no-iife-in-jsx-error-smoke.mjs` - smoke test runner for the no-IIFE-in-JSX rule. Future destination: `eslint-plugin`
- `no-iife-in-jsx-error-smoke.shared.mjs` - shared assertions for the no-IIFE-in-JSX smoke tests. Future destination: `eslint-plugin`

## integration
- `maersk-puppeteer-smoke.mjs` - browser-launch smoke for Maersk refresh flows. Future destination: `dev-tools`

## legacy
- No tracked files yet. Reserved for future removals.
