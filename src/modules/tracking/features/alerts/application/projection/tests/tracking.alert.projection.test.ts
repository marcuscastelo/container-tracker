import { describe, expect, it } from 'vitest'
import { toTrackingAlertProjection } from '~/modules/tracking/features/alerts/application/projection/tracking.alert.projection'

describe('toTrackingAlertProjection', () => {
  it('maps alert type, severity, and category to semantic projection values', () => {
    const result = toTrackingAlertProjection({
      id: 'a1',
      container_number: 'MSCU1234567',
      type: 'TRANSSHIPMENT',
      severity: 'warning',
      message_key: 'alerts.transshipmentDetected',
      message_params: {
        port: 'SGSIN',
        fromVessel: 'VESSEL A',
        toVessel: 'VESSEL B',
      },
      triggered_at: '2026-02-03T10:00:00.000Z',
      acked_at: null,
      category: 'fact',
      retroactive: false,
    })

    expect(result).toEqual({
      id: 'a1',
      containerNumber: 'MSCU1234567',
      type: 'transshipment',
      severity: 'warning',
      messageKey: 'alerts.transshipmentDetected',
      messageParams: {
        port: 'SGSIN',
        fromVessel: 'VESSEL A',
        toVessel: 'VESSEL B',
      },
      triggeredAtIso: '2026-02-03T10:00:00.000Z',
      ackedAtIso: null,
      category: 'fact',
      retroactive: false,
    })
  })

  it('falls back to info/monitoring for unsupported type/severity/category', () => {
    const result = toTrackingAlertProjection({
      id: 'a2',
      container_number: 'MSCU7654321',
      type: 'SOMETHING_NEW',
      severity: 'critical',
      message_key: 'alerts.dataInconsistent',
      message_params: {
        irrelevant: true,
      },
      triggered_at: '2026-02-03T10:00:00.000Z',
      acked_at: '2026-02-04T10:00:00.000Z',
      category: 'other',
      retroactive: true,
    })

    expect(result.type).toBe('info')
    expect(result.severity).toBe('info')
    expect(result.ackedAtIso).toBe('2026-02-04T10:00:00.000Z')
    expect(result.category).toBe('monitoring')
    expect(result.messageKey).toBe('alerts.dataInconsistent')
    expect(result.messageParams).toEqual({})
  })
})
