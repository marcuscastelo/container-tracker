import { describe, expect, it } from 'vitest'
import { toUniqueNormalizedVersions } from '~/modules/agent/application/normalize-blocked-versions'

describe('toUniqueNormalizedVersions', () => {
  it('trims values, removes blanks and deduplicates while preserving first appearance order', () => {
    const result = toUniqueNormalizedVersions([' 1.0.0 ', '', '2.0.0', '1.0.0', '  '])

    expect(result).toEqual(['1.0.0', '2.0.0'])
  })
})
