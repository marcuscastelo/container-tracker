import { describe, expect, it } from 'vitest'
import { toOptionalNonBlankString } from '~/modules/process/ui/mappers/toOptionalNonBlankString'

describe('toOptionalNonBlankString', () => {
  it('returns null for nullish values', () => {
    expect(toOptionalNonBlankString(null)).toBeNull()
    expect(toOptionalNonBlankString(undefined)).toBeNull()
  })

  it('returns null for blank or whitespace-only values', () => {
    expect(toOptionalNonBlankString('')).toBeNull()
    expect(toOptionalNonBlankString('   ')).toBeNull()
  })

  it('returns trimmed non-blank value', () => {
    expect(toOptionalNonBlankString('RD-123')).toBe('RD-123')
    expect(toOptionalNonBlankString('  RD-123  ')).toBe('RD-123')
  })
})
