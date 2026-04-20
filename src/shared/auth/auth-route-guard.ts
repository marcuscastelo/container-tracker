import { sanitizeReturnTo } from '~/shared/auth/auth-return-to'

const PUBLIC_AUTH_ROUTES = new Set([
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/auth/logout',
])

export function isPublicAuthRoute(pathname: string): boolean {
  return PUBLIC_AUTH_ROUTES.has(pathname)
}

export function buildAuthLoginRedirectHref(pathname: string, search: string): string {
  const returnTo = sanitizeReturnTo(`${pathname}${search}`)
  return `/auth/login?return_to=${encodeURIComponent(returnTo)}`
}
