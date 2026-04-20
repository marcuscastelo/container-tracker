import { describe, expect, it } from 'vitest'
import { resolveShipmentTrackingValidationDisplay } from '~/modules/process/ui/screens/shipment/lib/shipmentTrackingReviewDisplay'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

function makeShipmentDetailVm(): ShipmentDetailVM {
  return {
    id: 'process-1',
    trackingFreshnessToken: 'token-1',
    processRef: 'REF-1',
    reference: 'REF-1',
    carrier: 'maersk',
    bill_of_lading: null,
    booking_number: null,
    importer_name: 'Importer',
    exporter_name: 'Exporter',
    reference_importer: null,
    product: 'Cargo',
    redestination_number: null,
    origin: 'Shanghai',
    destination: 'Santos',
    status: 'blue-500',
    statusCode: 'IN_TRANSIT',
    statusMicrobadge: null,
    eta: null,
    processEtaDisplayVm: {
      kind: 'unavailable',
    },
    processEtaSecondaryVm: {
      visible: false,
      date: null,
      withEta: 0,
      total: 2,
      incomplete: false,
    },
    trackingValidation: {
      hasIssues: true,
      highestSeverity: 'warning',
      affectedContainerCount: 2,
      topIssue: {
        code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
        severity: 'warning',
        reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
        affectedArea: 'timeline',
        affectedLocation: 'Santos',
        affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
      },
    },
    containers: [
      {
        id: 'container-1',
        number: 'MNBU3094033',
        carrierCode: 'MAERSK',
        status: 'blue-500',
        statusCode: 'IN_TRANSIT',
        sync: {
          containerNumber: 'MNBU3094033',
          carrier: 'MAERSK',
          state: 'ok',
          relativeTimeAt: null,
          isStale: false,
        },
        eta: null,
        etaChipVm: {
          state: 'UNAVAILABLE',
          tone: 'neutral',
          date: null,
        },
        selectedEtaVm: null,
        currentContext: {
          locationCode: null,
          locationDisplay: null,
          vesselName: null,
          voyage: null,
          vesselVisible: true,
        },
        nextLocation: null,
        tsChipVm: {
          visible: false,
          count: 0,
          portsTooltip: null,
        },
        dataIssueChipVm: {
          visible: false,
        },
        trackingContainment: null,
        trackingValidation: {
          hasIssues: true,
          highestSeverity: 'warning',
          findingCount: 1,
          activeIssues: [
            {
              code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
              severity: 'warning',
              reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
              affectedArea: 'timeline',
              affectedLocation: 'Santos',
              affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
            },
          ],
        },
        transshipment: {
          hasTransshipment: false,
          count: 0,
          ports: [],
        },
        timeline: [],
      },
      {
        id: 'container-2',
        number: 'MNBU3094034',
        carrierCode: 'MAERSK',
        status: 'blue-500',
        statusCode: 'IN_TRANSIT',
        sync: {
          containerNumber: 'MNBU3094034',
          carrier: 'MAERSK',
          state: 'ok',
          relativeTimeAt: null,
          isStale: false,
        },
        eta: null,
        etaChipVm: {
          state: 'UNAVAILABLE',
          tone: 'neutral',
          date: null,
        },
        selectedEtaVm: null,
        currentContext: {
          locationCode: null,
          locationDisplay: null,
          vesselName: null,
          voyage: null,
          vesselVisible: true,
        },
        nextLocation: null,
        tsChipVm: {
          visible: false,
          count: 0,
          portsTooltip: null,
        },
        dataIssueChipVm: {
          visible: false,
        },
        trackingContainment: null,
        trackingValidation: {
          hasIssues: true,
          highestSeverity: 'warning',
          findingCount: 1,
          activeIssues: [
            {
              code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
              severity: 'warning',
              reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
              affectedArea: 'timeline',
              affectedLocation: 'Campinas',
              affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
            },
          ],
        },
        transshipment: {
          hasTransshipment: false,
          count: 0,
          ports: [],
        },
        timeline: [],
      },
    ],
    alerts: [],
    alertIncidents: {
      summary: {
        activeIncidents: 0,
        affectedContainers: 0,
        recognizedIncidents: 0,
      },
      active: [],
      recognized: [],
    },
  }
}

function makeHistoricalSync(): TrackingTimeTravelSyncVM {
  return {
    snapshotId: 'snapshot-2',
    fetchedAtIso: '2026-04-04T11:00:00.000Z',
    position: 2,
    statusCode: 'IN_TRANSIT',
    statusVariant: 'blue-500',
    timeline: [],
    alerts: [],
    eta: null,
    currentContext: {
      locationCode: null,
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: true,
    },
    nextLocation: null,
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
    },
    diff: {
      kind: 'comparison',
      statusChanged: false,
      previousStatusCode: 'IN_TRANSIT',
      currentStatusCode: 'IN_TRANSIT',
      timelineChanged: true,
      addedTimelineCount: 1,
      removedTimelineCount: 0,
      alertsChanged: false,
      newAlertsCount: 0,
      resolvedAlertsCount: 0,
      etaChanged: false,
      previousEta: null,
      currentEta: null,
      actualConflictAppeared: false,
      actualConflictResolved: false,
    },
    debugAvailable: true,
  }
}

describe('shipmentTrackingReviewDisplay', () => {
  it('keeps current process and container validation when historical sync is not selected', () => {
    const shipment = makeShipmentDetailVm()
    const result = resolveShipmentTrackingValidationDisplay({
      shipment,
      selectedContainerId: 'container-1',
      selectedSync: null,
    })

    expect(result.mode).toBe('current')
    expect(result.shipmentTrackingValidation).toEqual(shipment.trackingValidation)
    expect(result.containers).toEqual(shipment.containers)
  })

  it('overrides only the selected container and top banner with historical validation summary', () => {
    const result = resolveShipmentTrackingValidationDisplay({
      shipment: makeShipmentDetailVm(),
      selectedContainerId: 'container-1',
      selectedSync: makeHistoricalSync(),
    })

    expect(result.mode).toBe('historical')
    expect(result.shipmentTrackingValidation).toEqual({
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    })
    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
    })
    expect(result.containers[1]?.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'warning',
      findingCount: 1,
      activeIssues: [
        {
          code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
          severity: 'warning',
          reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
          affectedArea: 'timeline',
          affectedLocation: 'Campinas',
          affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
        },
      ],
    })
  })
})
