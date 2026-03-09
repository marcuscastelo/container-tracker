import { describe, expect, it } from 'vitest'
import { deriveProcessStatusFromContainers } from '~/modules/process/features/operational-projection/application/operational-projection/deriveProcessStatus'

describe('deriveProcessStatusFromContainers', () => {
  it('returns UNKNOWN when no statuses provided', () => {
    expect(deriveProcessStatusFromContainers([])).toBe('UNKNOWN')
  })

  it('returns the single status when only one container', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT'])).toBe('IN_TRANSIT')
  })

  it('returns PARTIALLY_DELIVERED when one container is in transit and another delivered', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT', 'DELIVERED'])).toBe(
      'PARTIALLY_DELIVERED',
    )
  })

  it('returns PARTIALLY_DELIVERED when one container is loaded and another empty returned', () => {
    expect(deriveProcessStatusFromContainers(['LOADED', 'EMPTY_RETURNED'])).toBe(
      'PARTIALLY_DELIVERED',
    )
  })

  it('returns most conservative pre-completion status when all still moving', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_PROGRESS', 'IN_TRANSIT'])).toBe(
      'IN_PROGRESS',
    )
  })

  it('returns IN_TRANSIT when one loaded and one in transit (both pre-completion)', () => {
    expect(deriveProcessStatusFromContainers(['LOADED', 'IN_TRANSIT'])).toBe('LOADED')
  })

  it('returns lowest post-completion status when all completed', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'DELIVERED'])).toBe('DISCHARGED')
  })

  it('returns DISCHARGED when all are discharged', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'DISCHARGED'])).toBe('DISCHARGED')
  })

  it('handles all UNKNOWN statuses', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'UNKNOWN'])).toBe('UNKNOWN')
  })

  it('AVAILABLE_FOR_PICKUP is returned when mixed with DELIVERED', () => {
    expect(deriveProcessStatusFromContainers(['AVAILABLE_FOR_PICKUP', 'DELIVERED'])).toBe(
      'AVAILABLE_FOR_PICKUP',
    )
  })

  it('DELIVERED is returned when all containers are delivered', () => {
    expect(deriveProcessStatusFromContainers(['DELIVERED', 'DELIVERED'])).toBe('DELIVERED')
  })

  it('EMPTY_RETURNED is returned when all containers are returned empty', () => {
    expect(deriveProcessStatusFromContainers(['EMPTY_RETURNED', 'EMPTY_RETURNED'])).toBe(
      'EMPTY_RETURNED',
    )
  })

  it('prefers informative status over UNKNOWN when pre-completion', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_TRANSIT'])).toBe('IN_TRANSIT')
  })

  it('PARTIALLY_DELIVERED with arrived_at_pod and delivered', () => {
    expect(deriveProcessStatusFromContainers(['ARRIVED_AT_POD', 'DELIVERED'])).toBe(
      'PARTIALLY_DELIVERED',
    )
  })
})
