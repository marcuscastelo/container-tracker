import { describe, expect, it } from 'vitest'
import { resolveShipmentTrackingContainmentDisplay } from '~/modules/process/ui/screens/shipment/lib/shipmentTrackingContainmentDisplay'
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
      total: 1,
      incomplete: false,
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
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
        trackingContainment: {
          active: true,
          reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
          activatedAt: '2026-04-08T12:00:00.000Z',
          externalTrackingUrl: 'https://www.maersk.com/tracking/MNBU3094033',
        },
        trackingValidation: {
          hasIssues: false,
          highestSeverity: null,
          findingCount: 0,
          activeIssues: [],
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
      timelineChanged: false,
      addedTimelineCount: 0,
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
    debugAvailable: false,
  }
}

describe('shipmentTrackingContainmentDisplay', () => {
  it('returns the selected container containment while the live timeline is active', () => {
    const containment = resolveShipmentTrackingContainmentDisplay({
      shipment: makeShipmentDetailVm(),
      selectedContainerId: 'container-1',
      selectedSync: null,
    })

    expect(containment).toEqual({
      active: true,
      reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
      activatedAt: '2026-04-08T12:00:00.000Z',
      externalTrackingUrl: 'https://www.maersk.com/tracking/MNBU3094033',
    })
  })

  it('hides the live containment notice while time travel mode is active', () => {
    const containment = resolveShipmentTrackingContainmentDisplay({
      shipment: makeShipmentDetailVm(),
      selectedContainerId: 'container-1',
      selectedSync: makeHistoricalSync(),
    })

    expect(containment).toBeNull()
  })
})
