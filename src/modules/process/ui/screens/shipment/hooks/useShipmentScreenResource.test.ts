import { describe, expect, it } from 'vitest'
import { mergeTrackingFieldsIntoShipment } from '~/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

function buildDefaultProcessEtaSecondaryVm(): ShipmentDetailVM['processEtaSecondaryVm'] {
  return {
    visible: true,
    date: '2026-04-10',
    withEta: 1,
    total: 2,
    incomplete: true,
  }
}

function buildDefaultProcessEtaDisplayVm(): ShipmentDetailVM['processEtaDisplayVm'] {
  return {
    kind: 'date',
    date: '2026-04-10',
  }
}

function buildDefaultAlertIncidents(): ShipmentDetailVM['alertIncidents'] {
  return {
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
        detectedAtIso: '2026-02-28T00:00:00.000Z',
        triggeredAtIso: '2026-04-01T10:00:00.000Z',
        transshipmentOrder: 1,
        port: 'KRPUS',
        fromVessel: 'MSC IRIS',
        toVessel: 'MSC BIANCA SILVIA',
        affectedContainerCount: 1,
        activeAlertIds: ['alert-active'],
        ackedAlertIds: [],
        members: [],
      },
    ],
    recognized: [],
  }
}

function buildDefaultShipmentDetailVm(): ShipmentDetailVM {
  return {
    id: 'process-1',
    trackingFreshnessToken: 'freshness-initial',
    processRef: 'REF-1',
    reference: 'REF-1',
    carrier: 'MSC',
    bill_of_lading: null,
    booking_number: null,
    importer_name: 'Importer',
    exporter_name: 'Exporter',
    reference_importer: null,
    product: 'Product',
    redestination_number: null,
    origin: 'Shanghai',
    destination: 'Santos',
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    statusMicrobadge: null,
    eta: '2026-04-10',
    processEtaDisplayVm: buildDefaultProcessEtaDisplayVm(),
    processEtaSecondaryVm: buildDefaultProcessEtaSecondaryVm(),
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    containers: [],
    alerts: [],
    alertIncidents: buildDefaultAlertIncidents(),
  }
}

function buildShipmentDetailVm(overrides: Partial<ShipmentDetailVM> = {}): ShipmentDetailVM {
  const defaults = buildDefaultShipmentDetailVm()

  return {
    ...defaults,
    ...overrides,
    eta: 'eta' in overrides ? (overrides.eta ?? null) : defaults.eta,
    processEtaDisplayVm: overrides.processEtaDisplayVm ?? defaults.processEtaDisplayVm,
    processEtaSecondaryVm: overrides.processEtaSecondaryVm ?? defaults.processEtaSecondaryVm,
    containers: overrides.containers ?? defaults.containers,
    alerts: overrides.alerts ?? defaults.alerts,
    alertIncidents: overrides.alertIncidents ?? defaults.alertIncidents,
  }
}

describe('useShipmentScreenResource', () => {
  it('merges refreshed tracking-derived fields without replacing non-tracking shipment metadata', () => {
    const current = buildShipmentDetailVm({
      trackingFreshnessToken: 'freshness-current',
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
      trackingFreshnessToken: 'freshness-latest',
      reference: 'REF-LATEST',
      importer_name: 'Importer Latest',
      status: 'amber-600',
      statusCode: 'AWAITING_DATA',
      statusMicrobadge: {
        statusCode: 'AWAITING_DATA',
        count: 1,
      },
      eta: null,
      processEtaDisplayVm: {
        kind: 'unavailable',
      },
      processEtaSecondaryVm: {
        visible: true,
        date: null,
        withEta: 0,
        total: 2,
        incomplete: true,
      },
      trackingValidation: {
        hasIssues: true,
        highestSeverity: 'danger',
        affectedContainerCount: 1,
        topIssue: {
          code: 'CONFLICTING_CRITICAL_ACTUALS',
          severity: 'danger',
          reasonKey: 'tracking.validation.conflictingCriticalActuals',
          affectedArea: 'series',
          affectedLocation: 'BRSSZ',
          affectedBlockLabelKey: null,
        },
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
            detectedAtIso: '2026-02-28T00:00:00.000Z',
            triggeredAtIso: '2026-04-01T10:00:00.000Z',
            transshipmentOrder: 1,
            port: 'KRPUS',
            fromVessel: 'MSC IRIS',
            toVessel: 'MSC BIANCA SILVIA',
            affectedContainerCount: 1,
            activeAlertIds: [],
            ackedAlertIds: ['alert-active'],
            members: [],
          },
        ],
      },
    })

    const merged = mergeTrackingFieldsIntoShipment(current, latest)

    expect(merged.reference).toBe('REF-CURRENT')
    expect(merged.importer_name).toBe('Importer Current')
    expect(merged.trackingFreshnessToken).toBe('freshness-latest')
    expect(merged.status).toBe('amber-600')
    expect(merged.statusCode).toBe('AWAITING_DATA')
    expect(merged.statusMicrobadge).toEqual({
      statusCode: 'AWAITING_DATA',
      count: 1,
    })
    expect(merged.eta).toBeNull()
    expect(merged.processEtaDisplayVm).toEqual({
      kind: 'unavailable',
    })
    expect(merged.processEtaSecondaryVm).toEqual({
      visible: true,
      date: null,
      withEta: 0,
      total: 2,
      incomplete: true,
    })
    expect(merged.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'danger',
      affectedContainerCount: 1,
      topIssue: {
        code: 'CONFLICTING_CRITICAL_ACTUALS',
        severity: 'danger',
        reasonKey: 'tracking.validation.conflictingCriticalActuals',
        affectedArea: 'series',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
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
