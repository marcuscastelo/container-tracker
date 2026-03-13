import { describe, expect, it } from 'vitest'
import {
  computeRowDistribution,
  MAX_PER_ROW,
} from '~/modules/process/ui/components/container-distribution'

describe('computeRowDistribution', () => {
  it('returns empty array for non-positive counts', () => {
    expect(computeRowDistribution(0)).toEqual([])
    expect(computeRowDistribution(-3)).toEqual([])
  })

  it('respects MAX_PER_ROW', () => {
    expect(MAX_PER_ROW).toBe(4)
  })

  it('matches documented examples', () => {
    const cases: Record<number, number[]> = {
      1: [1],
      2: [2],
      3: [3],
      4: [4],
      5: [3, 2],
      6: [3, 3],
      7: [4, 3],
      8: [4, 4],
      9: [3, 3, 3],
      10: [4, 3, 3],
      11: [4, 4, 3],
      12: [4, 4, 4],
      13: [4, 3, 3, 3],
      14: [4, 4, 3, 3],
      15: [4, 4, 4, 3],
      16: [4, 4, 4, 4],
      17: [4, 4, 3, 3, 3],
      18: [4, 4, 4, 3, 3],
      19: [4, 4, 4, 4, 3],
      20: [4, 4, 4, 4, 4],
    }

    for (const [k, v] of Object.entries(cases)) {
      const n = Number(k)
      expect(computeRowDistribution(n)).toEqual(v)
    }
  })
})
