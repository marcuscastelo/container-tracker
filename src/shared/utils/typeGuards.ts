// Lightweight type guards used across the codebase.
// Prefer Zod for complex validation, but these helpers are useful
// for narrowing unknown values without resorting to `any` or type assertions.

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function hasDefaultProp(v: unknown): v is { default: unknown } {
  return isRecord(v) && 'default' in v
}
