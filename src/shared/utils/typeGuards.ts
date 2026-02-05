export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function getStringProp(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined
  const v = obj[key]
  return typeof v === 'string' ? v : undefined
}

export function asString(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '')
}

export function isArrayOfUnknown(v: unknown): v is unknown[] {
  return Array.isArray(v)
}
