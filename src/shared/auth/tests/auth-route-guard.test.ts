import { describe, expect, it } from 'vitest'
import { buildAuthLoginRedirectHref, isPublicAuthRoute } from '~/shared/auth/auth-route-guard'

describe('auth route guard helpers', () => {
  it('marks auth routes as public', () => {
    expect(isPublicAuthRoute('/auth/login')).toBe(true)
    expect(isPublicAuthRoute('/auth/signup')).toBe(true)
    expect(isPublicAuthRoute('/auth/callback')).toBe(true)
    expect(isPublicAuthRoute('/auth/logout')).toBe(true)
  })

  it('marks non-auth route as protected', () => {
    expect(isPublicAuthRoute('/')).toBe(false)
    expect(isPublicAuthRoute('/shipments/123')).toBe(false)
  })

  it('builds login redirect with return_to for protected route', () => {
    expect(buildAuthLoginRedirectHref('/shipments/123', '?tab=timeline')).toBe(
      '/auth/login?return_to=%2Fshipments%2F123%3Ftab%3Dtimeline',
    )
  })
})
