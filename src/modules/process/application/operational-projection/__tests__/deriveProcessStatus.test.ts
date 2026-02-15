import { describe, expect, it } from 'vitest'
import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'

describe('deriveProcessStatusFromContainers', () => {
  it('returns UNKNOWN when no statuses provided', () => {
    expect(deriveProcessStatusFromContainers([])).toBe('UNKNOWN')
  })

  it('returns the single status when only one container', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT'])).toBe('IN_TRANSIT')
  })

  it('returns the highest-dominance status among multiple containers', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_PROGRESS', 'IN_TRANSIT'])).toBe(
      'IN_TRANSIT',
    )
  })

  it('selects DELIVERED over IN_TRANSIT', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT', 'DELIVERED'])).toBe('DELIVERED')
  })

  it('selects EMPTY_RETURNED as the highest dominance', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT', 'DELIVERED', 'EMPTY_RETURNED'])).toBe(
      'EMPTY_RETURNED',
    )
  })

  it('handles all UNKNOWN statuses', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'UNKNOWN'])).toBe('UNKNOWN')
  })

  it('DISCHARGED dominates ARRIVED_AT_POD', () => {
    expect(deriveProcessStatusFromContainers(['ARRIVED_AT_POD', 'DISCHARGED'])).toBe('DISCHARGED')
  })

  it('AVAILABLE_FOR_PICKUP dominates DISCHARGED', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'AVAILABLE_FOR_PICKUP'])).toBe(
      'AVAILABLE_FOR_PICKUP',
    )
  })
})
