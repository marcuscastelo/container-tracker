import { describe, expect, it } from 'vitest'
import { getAppErrorDetails } from '~/app-error-details'

describe('getAppErrorDetails', () => {
  it('hides error details outside development', () => {
    expect(getAppErrorDetails(new Error('database credentials leaked'), false)).toBeNull()
  })

  it('shows the stack or message in development', () => {
    const details = getAppErrorDetails(new Error('database credentials leaked'), true)
    expect(details).toContain('database credentials leaked')
  })

  it('stringifies non-error values in development', () => {
    expect(getAppErrorDetails({ reason: 'boom' }, true)).toBe('[object Object]')
  })
})
