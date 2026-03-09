import { describe, expect, it } from 'vitest'
import {
  type TrackingAlertDisplayReadModel,
  type TrackingAlertDisplaySource,
  toTrackingAlertDisplayReadModel,
  toTrackingAlertDisplayReadModels,
} from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'

function makeTransshipmentAlertSource(): TrackingAlertDisplaySource {
  return {
    id: 'alert-1',
    container_id: 'container-1',
    category: 'fact',
    type: 'TRANSSHIPMENT',
    severity: 'warning',
    message_key: 'alerts.transshipmentDetected',
    message_params: {
      port: 'SGSIN',
      fromVessel: 'VESSEL A',
      toVessel: 'VESSEL B',
    },
    detected_at: '2026-03-08T10:00:00.000Z',
    triggered_at: '2026-03-08T10:01:00.000Z',
    retroactive: false,
    provider: 'maersk',
    acked_at: null,
  }
}

describe('tracking.alert-display.readmodel', () => {
  it('maps one alert and trims resolved container number', () => {
    const alert = makeTransshipmentAlertSource()

    const result = toTrackingAlertDisplayReadModel(alert, (containerId) =>
      containerId === 'container-1' ? ' MSCU1234567 ' : null,
    )

    expect(result.container_number).toBe('MSCU1234567')
    expect(result.message_key).toBe('alerts.transshipmentDetected')
    expect(result.message_params).toEqual({
      port: 'SGSIN',
      fromVessel: 'VESSEL A',
      toVessel: 'VESSEL B',
    })
  })

  it('throws when container number cannot be resolved', () => {
    const alert = makeTransshipmentAlertSource()

    expect(() => toTrackingAlertDisplayReadModel(alert, () => null)).toThrowError(
      'tracking alert display projection: missing container number for container_id=container-1',
    )
  })

  it('throws when resolved container number is blank after trim', () => {
    const alert = makeTransshipmentAlertSource()

    expect(() => toTrackingAlertDisplayReadModel(alert, () => '   ')).toThrowError(
      'tracking alert display projection: empty container number for container_id=container-1',
    )
  })

  it('maps multiple alerts preserving order', () => {
    const first = makeTransshipmentAlertSource()
    const second: TrackingAlertDisplaySource = {
      id: 'alert-2',
      container_id: 'container-2',
      category: 'monitoring',
      type: 'ETA_MISSING',
      severity: 'info',
      message_key: 'alerts.etaMissing',
      message_params: {},
      detected_at: '2026-03-08T11:00:00.000Z',
      triggered_at: '2026-03-08T11:01:00.000Z',
      retroactive: false,
      provider: null,
      acked_at: null,
    }

    const result: readonly TrackingAlertDisplayReadModel[] = toTrackingAlertDisplayReadModels(
      [first, second],
      (containerId) => (containerId === 'container-1' ? 'MSCU1234567' : 'MSCU7654321'),
    )

    expect(result.map((item) => item.id)).toEqual(['alert-1', 'alert-2'])
    expect(result.map((item) => item.container_number)).toEqual(['MSCU1234567', 'MSCU7654321'])
  })
})
