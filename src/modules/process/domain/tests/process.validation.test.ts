import { describe, expect, it } from 'vitest'
import { normalizeDepositary } from '~/modules/process/domain/process.validation'

describe('process.validation normalizeDepositary', () => {
  it('trims non-empty values', () => {
    expect(normalizeDepositary('  Santos Brasil  ')).toBe('Santos Brasil')
  })

  it('collapses empty-like values to null', () => {
    expect(normalizeDepositary('')).toBeNull()
    expect(normalizeDepositary('   ')).toBeNull()
    expect(normalizeDepositary(null)).toBeNull()
    expect(normalizeDepositary(undefined)).toBeNull()
  })
})
