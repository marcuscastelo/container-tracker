import { describe, expect, it } from 'vitest'
import { toTrackingAlertProjection } from '~/modules/tracking/application/projection/tracking.alert.projection'

describe('toTrackingAlertProjection', () => {
  it('maps alert type, severity, and category to semantic projection values', () => {
    const result = toTrackingAlertProjection({
      id: 'a1',
      type: 'TRANSSHIPMENT',
      severity: 'warning',
      message: 'Transshipment detected',
      triggered_at: '2026-02-03T10:00:00.000Z',
      acked_at: null,
      category: 'fact',
      retroactive: false,
    })

    expect(result).toEqual({
      id: 'a1',
      type: 'transshipment',
      severity: 'warning',
      message: 'Transshipment detected',
      triggeredAtIso: '2026-02-03T10:00:00.000Z',
      ackedAtIso: null,
      category: 'fact',
      retroactive: false,
    })
  })

  it('falls back to info/monitoring for unsupported values', () => {
    const result = toTrackingAlertProjection({
      id: 'a2',
      type: 'SOMETHING_NEW',
      severity: 'critical',
      message: 'unknown',
      triggered_at: '2026-02-03T10:00:00.000Z',
      acked_at: '2026-02-04T10:00:00.000Z',
      category: 'other',
      retroactive: true,
    })

    expect(result.type).toBe('info')
    expect(result.severity).toBe('info')
    expect(result.ackedAtIso).toBe('2026-02-04T10:00:00.000Z')
    expect(result.category).toBe('monitoring')
  })
})
