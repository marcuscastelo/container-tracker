import { describe, expect, it } from 'vitest'

import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'

describe('toProcessSource', () => {
  it('keeps canonical lowercase values unchanged', () => {
    expect(toProcessSource('manual')).toBe('manual')
  })

  it('normalizes legacy uppercase values to lowercase', () => {
    expect(toProcessSource('MANUAL')).toBe('manual')
  })

  it('trims surrounding whitespace before normalizing', () => {
    expect(toProcessSource('  manual  ')).toBe('manual')
  })
})
