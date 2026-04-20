const AUTH_ROUTES = new Set(['/auth/login', '/auth/signup', '/auth/callback', '/auth/logout'])

function isUnsafeAbsolutePath(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')
}

export function sanitizeReturnTo(candidate: string | null | undefined): string {
  if (typeof candidate !== 'string') return '/'
  const trimmed = candidate.trim()
  if (trimmed.length === 0) return '/'
  if (isUnsafeAbsolutePath(trimmed)) return '/'
  if (!trimmed.startsWith('/')) return '/'

  const basePath = trimmed.split('?')[0]?.split('#')[0]
  if (typeof basePath === 'string' && AUTH_ROUTES.has(basePath)) {
    return '/'
  }

  return trimmed
}

export function getReturnToFromQuery(search: string): string {
  const params = new URLSearchParams(search)
  const returnTo = params.get('return_to')
  return sanitizeReturnTo(returnTo)
}

export function resolveReturnToFromCallbackSearch(search: string): string {
  const params = new URLSearchParams(search)
  const stateParam = params.get('state')
  if (stateParam) {
    try {
      const parsed: unknown = JSON.parse(stateParam)
      if (typeof parsed === 'object' && parsed !== null && 'returnTo' in parsed) {
        const returnToCandidate = parsed.returnTo
        if (typeof returnToCandidate === 'string') {
          return sanitizeReturnTo(returnToCandidate)
        }
      }
    } catch (_error) {}
  }

  return getReturnToFromQuery(search)
}

export function extractAuthCallbackSearchFromReturnTo(returnTo: string): string | null {
  const sanitized = sanitizeReturnTo(returnTo)
  const queryIndex = sanitized.indexOf('?')
  if (queryIndex < 0) return null
  const query = sanitized.slice(queryIndex + 1)
  const params = new URLSearchParams(query)
  if (!params.has('code')) return null
  return `?${params.toString()}`
}
