import { describe, expect, it } from 'vitest'
import {
  deriveProcessStatusDispersion,
  deriveProcessStatusFromContainers,
} from '~/modules/process/features/operational-projection/application/deriveProcessStatus'

describe('deriveProcessStatusFromContainers', () => {
  it('returns UNKNOWN when no statuses provided', () => {
    expect(deriveProcessStatusFromContainers([])).toBe('UNKNOWN')
  })

  it('returns UNKNOWN when all containers are UNKNOWN', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'UNKNOWN'])).toBe('UNKNOWN')
  })

  it('returns BOOKED when all known statuses are pre-shipment', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_PROGRESS'])).toBe('BOOKED')
  })

  it('returns IN_TRANSIT for single transit container', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT'])).toBe('IN_TRANSIT')
  })

  it('returns ARRIVED_AT_POD for single arrived-at-pod container', () => {
    expect(deriveProcessStatusFromContainers(['ARRIVED_AT_POD'])).toBe('ARRIVED_AT_POD')
  })

  it('ignores UNKNOWN when there are known statuses', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'ARRIVED_AT_POD'])).toBe('ARRIVED_AT_POD')
  })

  it('returns IN_TRANSIT when IN_TRANSIT and ARRIVED_AT_POD are mixed', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT', 'ARRIVED_AT_POD'])).toBe('IN_TRANSIT')
  })

  it('returns ARRIVED_AT_POD when ARRIVED_AT_POD and DISCHARGED are mixed', () => {
    expect(deriveProcessStatusFromContainers(['ARRIVED_AT_POD', 'DISCHARGED'])).toBe(
      'ARRIVED_AT_POD',
    )
  })

  it('returns IN_TRANSIT when transit and discharged are mixed', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT', 'DISCHARGED'])).toBe('IN_TRANSIT')
  })

  it('returns IN_TRANSIT when any container is loaded/on-route/arrived', () => {
    expect(deriveProcessStatusFromContainers(['LOADED', 'ARRIVED_AT_POD'])).toBe('IN_TRANSIT')
  })

  it('returns DISCHARGED when all are discharged', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'DISCHARGED'])).toBe('DISCHARGED')
  })

  it('returns DISCHARGED when discharged and delivered are mixed', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'DELIVERED'])).toBe('DISCHARGED')
  })

  it('returns DELIVERED when all are completed', () => {
    expect(deriveProcessStatusFromContainers(['DELIVERED', 'EMPTY_RETURNED'])).toBe('DELIVERED')
  })

  it('ignores UNKNOWN for mixed unknown + post-arrival', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'DISCHARGED'])).toBe('DISCHARGED')
  })

  it('keeps IN_TRANSIT when one unknown and one in transit', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_TRANSIT'])).toBe('IN_TRANSIT')
  })
})

describe('deriveProcessStatusDispersion', () => {
  it('returns no microbadge when all container statuses are UNKNOWN', () => {
    const statuses = ['UNKNOWN', 'UNKNOWN'] as const
    const primaryStatus = deriveProcessStatusFromContainers(statuses)
    const result = deriveProcessStatusDispersion({
      statuses,
      primaryStatus,
    })

    expect(primaryStatus).toBe('UNKNOWN')
    expect(result.status_microbadge).toBeNull()
    expect(result.status_counts.UNKNOWN).toBe(2)
    expect(result.has_status_dispersion).toBe(false)
  })

  it('derives ARRIVED_AT_POD microbadge when process is still IN_TRANSIT', () => {
    const statuses = ['IN_TRANSIT', 'ARRIVED_AT_POD'] as const
    const primaryStatus = deriveProcessStatusFromContainers(statuses)
    const result = deriveProcessStatusDispersion({
      statuses,
      primaryStatus,
    })

    expect(primaryStatus).toBe('IN_TRANSIT')
    expect(result.status_microbadge).toEqual({
      status: 'ARRIVED_AT_POD',
      count: 1,
    })
    expect(result.has_status_dispersion).toBe(true)
  })

  it('derives DISCHARGED microbadge with proper count for mixed IN_TRANSIT + DISCHARGED statuses', () => {
    const statuses = ['IN_TRANSIT', 'DISCHARGED', 'DISCHARGED'] as const
    const primaryStatus = deriveProcessStatusFromContainers(statuses)
    const result = deriveProcessStatusDispersion({
      statuses,
      primaryStatus,
    })

    expect(primaryStatus).toBe('IN_TRANSIT')
    expect(result.status_microbadge).toEqual({
      status: 'DISCHARGED',
      count: 2,
    })
    expect(result.status_counts.DISCHARGED).toBe(2)
  })

  it('derives DELIVERED microbadge when process primary status remains DISCHARGED', () => {
    const statuses = ['DISCHARGED', 'DELIVERED'] as const
    const primaryStatus = deriveProcessStatusFromContainers(statuses)
    const result = deriveProcessStatusDispersion({
      statuses,
      primaryStatus,
    })

    expect(primaryStatus).toBe('DISCHARGED')
    expect(result.status_microbadge).toEqual({
      status: 'DELIVERED',
      count: 1,
    })
  })

  it('returns no microbadge for homogeneous status distributions', () => {
    const statuses = ['IN_TRANSIT', 'IN_TRANSIT'] as const
    const primaryStatus = deriveProcessStatusFromContainers(statuses)
    const result = deriveProcessStatusDispersion({
      statuses,
      primaryStatus,
    })

    expect(primaryStatus).toBe('IN_TRANSIT')
    expect(result.status_microbadge).toBeNull()
    expect(result.has_status_dispersion).toBe(false)
  })
})
