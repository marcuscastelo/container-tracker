import { describe, expect, it } from 'vitest'
import { mapParsedStatusToF1 } from '~/adapters/canonical/toCanonical.adapter'

describe('mapParsedStatusToF1', () => {
  it('parses eta when provided as ISO string and reads carrier from p.source.api', () => {
    const parsed = {
      process_id: 'proc-1',
      containers: [
        {
          container_number: 'ABCD1234567',
          eta: '2026-02-04T12:00:00Z',
          status: 'AVAILABLE',
        },
      ],
      source: { api: 'carrier-x' },
    }

    const res = mapParsedStatusToF1(parsed, 'ABCD1234567', 'provider-fallback')
    if (!res.ok) {
      // helpful debug output during test runs
      console.error('mapParsedStatusToF1 error:', res.error)
    }
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const shipment = res.shipment
    expect(shipment.containers.length).toBeGreaterThan(0)
    const c = shipment.containers[0]
    expect(c.container_number).toBe('ABCD1234567')
    expect(c.eta).toBeInstanceOf(Date)
    expect(shipment.carrier).toBe('carrier-x')
  })

  it('falls back to provider when p.source.api is missing and treats non-date eta as missing', () => {
    const parsed = {
      process: 'proc-2',
      containers: [
        {
          container_number: 'WXYZ0000001',
          eta: {},
        },
      ],
      // no source field
    }

    const res = mapParsedStatusToF1(parsed, 'WXYZ0000001', 'maersk')
    if (!res.ok) {
      console.error('mapParsedStatusToF1 error:', res.error)
    }
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const shipment = res.shipment
    const c = shipment.containers[0]
    // eta may be undefined or null depending on normalization; accept both
    expect(c.eta == null).toBe(true)
    expect(c.flags?.missing_eta).toBe(true)
    expect(shipment.carrier).toBe('maersk')
  })
})
