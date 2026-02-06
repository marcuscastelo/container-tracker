// TODO: Replace usages of isRecord with proper Zod schemas and safeParseOrDefault in all modules, then delete this file and its exports.
/**
 * @deprecated Use Zod schemas and safeParseOrDefault instead of these type guards and coercion functions.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// TODO: Replace usages of getStringProp with proper Zod schemas and safeParseOrDefault in all modules, then delete this function.
/*
 * @deprecated Use Zod schemas and safeParseOrDefault instead of these type guards and coercion functions.
 */
export function getStringProp(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined
  const v = obj[key]
  return typeof v === 'string' ? v : undefined
}

// TODO: Replace usages of asString with proper Zod schemas and safeParseOrDefault in all modules, then delete this function.
/*
 * @deprecated Use Zod schemas and safeParseOrDefault instead of these type guards and coercion functions.
 */
export function asString(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '')
}

// TODO: Replace usages of isArrayOfUnknown with proper Zod schemas and safeParseOrDefault in all modules, then delete this function.
/*
 * @deprecated Use Zod schemas and safeParseOrDefault instead of these type guards and coercion functions.
 */
export function isArrayOfUnknown(v: unknown): v is unknown[] {
  return Array.isArray(v)
}
