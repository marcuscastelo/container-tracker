import { describe, expect, it } from 'vitest'
import { mergeTrackingFieldsIntoShipment } from '~/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

function buildShipmentDetailVm(
  overrides: Partial<ShipmentDetailVM> = {},
): ShipmentDetailVM {
  return {
    id: overrides.id ?? 'process-1',
    processRef: overrides.processRef ?? 'REF-1',
    reference: overrides.reference ?? 'REF-1',
    carrier: overrides.carrier ?? 'MSC',
    bill_of_lading: overrides.bill_of_lading ?? null,
    booking_number: overrides.booking_number ?? null,
    importer_name: overrides.importer_name ?? 'Importer',
    exporter_name: overrides.exporter_name ?? 'Exporter',
    reference_importer: overrides.reference_importer ?? null,
    product: overrides.product ?? 'Product',
    redestination_number: overrides.redestination_number ?? null,
    origin: overrides.origin ?? 'Shanghai',
    destination: overrides.destination ?? 'Santos',
    status: overrides.status ?? 'in-transit',
    statusCode: overrides.statusCode ?? 'IN_TRANSIT',
    statusMicrobadge: overrides.statusMicrobadge ?? null,
    eta: 'eta' in overrides ? (overrides.eta ?? null) : '2026-04-10',
    processEtaSecondaryVm: overrides.processEtaSecondaryVm ?? {
      visible: true,
      date: '2026-04-10',
      withEta: 1,
      total: 2,
      incomplete: true,
    },
    containers: overrides.containers ?? [],
    alerts: overrides.alerts ?? [],
    alertIncidents: overrides.alertIncidents ?? {
      summary: {
        activeIncidents: 1,
        affectedContainers: 1,
        recognizedIncidents: 0,
      },
      active: [
        {
          incidentKey: 'incident-active',
          bucket: 'active',
          category: 'movement',
          type: 'TRANSSHIPMENT',
          severity: 'warning',
          messageKey: 'alerts.transshipmentDetected',
          messageParams: {
            port: 'KRPUS',
            fromVessel: 'MSC IRIS',
            toVessel: 'MSC BIANCA SILVIA',
          },
          triggeredAtIso: '2026-04-01T10:00:00.000Z',
          thresholdDays: null,
          daysWithoutMovement: null,
          lastEventDate: null,
          transshipmentOrder: 1,
          port: 'KRPUS',
          fromVessel: 'MSC IRIS',
          toVessel: 'MSC BIANCA SILVIA',
          affectedContainerCount: 1,
          activeAlertIds: ['alert-active'],
          ackedAlertIds: [],
          members: [],
          monitoringHistory: [],
        },
      ],
      recognized: [],
    },
  }
}

describe('useShipmentScreenResource', () => {
  it('merges refreshed tracking-derived fields without replacing non-tracking shipment metadata', () => {
    const current = buildShipmentDetailVm({
      reference: 'REF-CURRENT',
      importer_name: 'Importer Current',
      status: 'in-transit',
      statusCode: 'IN_TRANSIT',
      eta: '2026-04-10',
      processEtaSecondaryVm: {
        visible: true,
        date: '2026-04-10',
        withEta: 1,
        total: 2,
        incomplete: true,
      },
      alerts: [
        {
          id: 'alert-active',
          type: 'transshipment',
          severity: 'warning',
          containerNumber: 'MSCU1234567',
          messageKey: 'alerts.transshipmentDetected',
          messageParams: {
            port: 'KRPUS',
            fromVessel: 'MSC IRIS',
            toVessel: 'MSC BIANCA SILVIA',
          },
          timestamp: '2026-04-01T10:00:00.000Z',
          triggeredAtIso: '2026-04-01T10:00:00.000Z',
          ackedAtIso: null,
          lifecycleState: 'ACTIVE',
          category: 'fact',
          retroactive: false,
        },
      ],
    })

    const latest = buildShipmentDetailVm({
      reference: 'REF-LATEST',
      importer_name: 'Importer Latest',
      status: 'amber-600',
      statusCode: 'AWAITING_DATA',
      statusMicrobadge: {
        statusCode: 'AWAITING_DATA',
        count: 1,
      },
      eta: null,
      processEtaSecondaryVm: {
        visible: true,
        date: null,
        withEta: 0,
        total: 2,
        incomplete: true,
      },
      alerts: [],
      alertIncidents: {
        summary: {
          activeIncidents: 0,
          affectedContainers: 0,
          recognizedIncidents: 1,
        },
        active: [],
        recognized: [
          {
            incidentKey: 'incident-recognized',
            bucket: 'recognized',
            category: 'movement',
            type: 'TRANSSHIPMENT',
            severity: 'warning',
            messageKey: 'alerts.transshipmentDetected',
            messageParams: {
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
            },
            triggeredAtIso: '2026-04-01T10:00:00.000Z',
            thresholdDays: null,
            daysWithoutMovement: null,
            lastEventDate: null,
            transshipmentOrder: 1,
            port: 'KRPUS',
            fromVessel: 'MSC IRIS',
            toVessel: 'MSC BIANCA SILVIA',
            affectedContainerCount: 1,
            activeAlertIds: [],
            ackedAlertIds: ['alert-active'],
            members: [],
            monitoringHistory: [],
          },
        ],
      },
    })

    const merged = mergeTrackingFieldsIntoShipment(current, latest)

    expect(merged.reference).toBe('REF-CURRENT')
    expect(merged.importer_name).toBe('Importer Current')
    expect(merged.status).toBe('amber-600')
    expect(merged.statusCode).toBe('AWAITING_DATA')
    expect(merged.statusMicrobadge).toEqual({
      statusCode: 'AWAITING_DATA',
      count: 1,
    })
    expect(merged.eta).toBeNull()
    expect(merged.processEtaSecondaryVm).toEqual({
      visible: true,
      date: null,
      withEta: 0,
      total: 2,
      incomplete: true,
    })
    expect(merged.alerts).toEqual([])
    expect(merged.alertIncidents.summary).toEqual({
      activeIncidents: 0,
      affectedContainers: 0,
      recognizedIncidents: 1,
    })
    expect(merged.alertIncidents.recognized[0]?.ackedAlertIds).toEqual(['alert-active'])
  })
})
