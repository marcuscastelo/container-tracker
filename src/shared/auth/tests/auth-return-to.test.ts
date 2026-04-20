import { describe, expect, it } from 'vitest'
import {
  extractAuthCallbackSearchFromReturnTo,
  getReturnToFromQuery,
  resolveReturnToFromCallbackSearch,
  sanitizeReturnTo,
} from '~/shared/auth/auth-return-to'

describe('auth return_to helpers', () => {
  it('keeps safe in-app relative path', () => {
    expect(sanitizeReturnTo('/shipments/abc?tab=timeline')).toBe('/shipments/abc?tab=timeline')
  })

  it('blocks absolute and protocol-relative urls', () => {
    expect(sanitizeReturnTo('https://evil.example')).toBe('/')
    expect(sanitizeReturnTo('//evil.example')).toBe('/')
  })

  it('blocks non-relative paths and auth routes', () => {
    expect(sanitizeReturnTo('shipments/abc')).toBe('/')
    expect(sanitizeReturnTo('/auth/callback?code=1')).toBe('/')
  })

  it('reads return_to query with sanitization', () => {
    expect(getReturnToFromQuery('?return_to=%2Faccess')).toBe('/access')
    expect(getReturnToFromQuery('?return_to=https%3A%2F%2Fevil.example')).toBe('/')
  })

  it('resolves callback return priority: state then query then fallback', () => {
    expect(
      resolveReturnToFromCallbackSearch(
        '?state=%7B%22returnTo%22%3A%22%2Fshipments%2F1%22%7D&return_to=%2Faccess',
      ),
    ).toBe('/shipments/1')
    expect(resolveReturnToFromCallbackSearch('?return_to=%2Faccess')).toBe('/access')
    expect(resolveReturnToFromCallbackSearch('')).toBe('/')
  })

  it('extracts nested callback query when return_to contains auth code', () => {
    expect(
      extractAuthCallbackSearchFromReturnTo('/?code=abc123&state=%7B%22returnTo%22%3A%22%2F%22%7D'),
    ).toBe('?code=abc123&state=%7B%22returnTo%22%3A%22%2F%22%7D')
    expect(extractAuthCallbackSearchFromReturnTo('/shipments')).toBeNull()
  })
})
