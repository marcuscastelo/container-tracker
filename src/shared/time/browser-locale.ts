export function getBrowserLocale(fallback: string): string {
  if (typeof navigator === 'undefined') return fallback
  return navigator.language || fallback
}
