# Code Style & Conventions: Container Tracker

## TypeScript
- Strict typing, no `any`, no `as` (except `as const` for tuples)
- Prefer `unknown` + type guards
- Use `readonly` where possible
- Canonical enums/unions for domain types (ContainerStatus, EventType, AlertCategory, Severity)
- Explicit narrowing for external data (guards, Zod validation)
- Small, deterministic functions (no hidden side effects)
- Static imports only (no `await import`)
- Named exports only (no `export default`)

## BiomeJS / ESLint
- Biome is primary formatter/linter
- No unused vars, no implicit any, no floating promises
- Prefer `const`, explicit return types
- ESLint for SolidJS-specific rules

## SolidJS
- Use `createSignal` for local state, `createMemo` for derived state
- `createEffect` only for side-effects
- Pure components, well-typed props
- UI states: `loading | empty | error | ready`
- No domain logic in UI

## TailwindCSS
- Utility classes only, no inline styles
- Dense, operational UI
- Status always visible (icon + text)

## i18n
- All strings via i18n keys
- Keys defined in a `keys` object per component, used via `t(keys.someKey)`
- New keys must be added to all locale files and checked with `pnpm i18n:check`

## Domain Rules
- Never persist final state; derive from events + rules
- Preserve raw payloads
- Parsing failures generate `Alert[data]`
- Incomplete data is valid and must be explained in UI

---
See `.github/copilot-instructions.md` and `docs/master-consolidated-0209.md` for full rules.