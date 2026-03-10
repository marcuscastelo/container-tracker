import { describe, expect, it } from 'vitest'
import { deriveProcessStatusFromContainers } from '~/modules/process/features/operational-projection/application/deriveProcessStatus'

describe('deriveProcessStatusFromContainers', () => {
  it('returns UNKNOWN when no statuses provided', () => {
    expect(deriveProcessStatusFromContainers([])).toBe('UNKNOWN')
  })

  it('returns IN_TRANSIT for single transit container', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT'])).toBe('IN_TRANSIT')
  })

  it('returns IN_TRANSIT when transit and discharged are mixed', () => {
    expect(deriveProcessStatusFromContainers(['IN_TRANSIT', 'DISCHARGED'])).toBe('IN_TRANSIT')
  })

  it('returns DISCHARGED when all are discharged', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'DISCHARGED'])).toBe('DISCHARGED')
  })

  it('returns DISCHARGED when all are discharged or beyond and at least one is not delivered', () => {
    expect(deriveProcessStatusFromContainers(['DISCHARGED', 'DELIVERED'])).toBe('DISCHARGED')
  })

  it('returns IN_TRANSIT when any container is loaded/on-route/arrived', () => {
    expect(deriveProcessStatusFromContainers(['LOADED', 'ARRIVED_AT_POD'])).toBe('IN_TRANSIT')
  })

  it('returns BOOKED when all are pre-shipment', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_PROGRESS'])).toBe('BOOKED')
  })

  it('returns DELIVERED when all are completed', () => {
    expect(deriveProcessStatusFromContainers(['DELIVERED', 'EMPTY_RETURNED'])).toBe('DELIVERED')
  })

  it('uses IN_TRANSIT fallback for mixed unknown + post-arrival', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'DISCHARGED'])).toBe('IN_TRANSIT')
  })

  it('keeps IN_TRANSIT when one unknown and one in transit', () => {
    expect(deriveProcessStatusFromContainers(['UNKNOWN', 'IN_TRANSIT'])).toBe('IN_TRANSIT')
  })
})
