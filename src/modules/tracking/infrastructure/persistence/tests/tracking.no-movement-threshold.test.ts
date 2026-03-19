import { describe, expect, it } from 'vitest'
import {
  classifyNoMovementBreakpoint,
  normalizeNoMovementThresholdDays,
} from '~/modules/tracking/features/alerts/domain/policy/no-movement-alert-policy'

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

describe('classifyNoMovementBreakpoint', () => {
  it('returns null before the first configured breakpoint', () => {
    expect(classifyNoMovementBreakpoint(4)).toBeNull()
  })

  it('returns the highest configured breakpoint that has been crossed', () => {
    expect(classifyNoMovementBreakpoint(5)).toBe(5)
    expect(classifyNoMovementBreakpoint(19)).toBe(10)
    expect(classifyNoMovementBreakpoint(30)).toBe(30)
  })
})
