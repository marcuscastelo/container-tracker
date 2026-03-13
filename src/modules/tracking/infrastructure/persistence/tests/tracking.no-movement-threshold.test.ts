import { describe, expect, it } from 'vitest'
import { normalizeNoMovementThresholdDays } from '~/modules/tracking/infrastructure/persistence/tracking.no-movement-threshold'

describe('normalizeNoMovementThresholdDays', () => {
  it('keeps values below first breakpoint without forcing to 5', () => {
    expect(normalizeNoMovementThresholdDays(4.9)).toBe(4)
  })

  it('snaps values to nearest configured lower breakpoint', () => {
    expect(normalizeNoMovementThresholdDays(9.9)).toBe(5)
    expect(normalizeNoMovementThresholdDays(10.1)).toBe(10)
    expect(normalizeNoMovementThresholdDays(27.2)).toBe(20)
  })

  it('uses highest configured breakpoint when value exceeds all', () => {
    expect(normalizeNoMovementThresholdDays(45)).toBe(30)
  })
})
