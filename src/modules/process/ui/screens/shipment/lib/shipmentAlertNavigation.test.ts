import { describe, expect, it, vi } from 'vitest'
import {
  resolveShipmentAlertNavigationAction,
  SHIPMENT_CURRENT_STATUS_SECTION_ID,
  scrollShipmentCurrentStatusIntoView,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlertNavigation'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { ProcessContainerNavigationState } from '~/shared/ui/navigation/app-navigation'

function makeNavigationState(
  requestKey: string = 'navbar-incident-1',
): ProcessContainerNavigationState {
  return {
    source: 'navbar-incidents',
    focusSection: 'current-status',
    revealLiveStatus: true,
    requestKey,
  }
}

function makeShipment(containers: ShipmentDetailVM['containers']): ShipmentDetailVM {
  return {
    id: 'process-1',
    trackingFreshnessToken: 'token-process-1',
    processRef: 'PROC-1',
    reference: 'PROC-1',
    carrier: 'MSC',
    bill_of_lading: null,
    booking_number: null,
    importer_name: null,
    exporter_name: null,
    reference_importer: null,
    product: null,
    redestination_number: null,
    origin: 'Shanghai',
    destination: 'Santos',
    status: 'in-transit',
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
      total: containers.length,
      incomplete: false,
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    containers,
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

function makeContainer(id: string, number: string): ShipmentDetailVM['containers'][number] {
  return {
    id,
    number,
    carrierCode: 'MSC',
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    sync: {
      containerNumber: number,
      carrier: 'MSC',
      state: 'ok',
      relativeTimeAt: null,
      isStale: false,
    },
    eta: null,
    etaApplicable: true,
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
  }
}

describe('resolveShipmentAlertNavigationAction', () => {
  it('returns null when there is no shipment alert navigation state', () => {
    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: null,
        handledRequestKey: null,
        shipment: undefined,
        preferredContainerNumber: null,
        selectedContainer: null,
        isTrackingTimeTravelActive: false,
      }),
    ).toBeNull()
  })

  it('returns null when the navigation request was already handled', () => {
    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: makeNavigationState('navbar-incident-2'),
        handledRequestKey: 'navbar-incident-2',
        shipment: undefined,
        preferredContainerNumber: null,
        selectedContainer: null,
        isTrackingTimeTravelActive: false,
      }),
    ).toBeNull()
  })

  it('waits until shipment data and a selected container are available', () => {
    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: makeNavigationState(),
        handledRequestKey: null,
        shipment: undefined,
        preferredContainerNumber: 'MSCU1234567',
        selectedContainer: null,
        isTrackingTimeTravelActive: false,
      }),
    ).toBe('wait')
  })

  it('closes time-travel before scrolling back to the live status panel', () => {
    const shipment = makeShipment([makeContainer('container-1', 'MSCU1234567')])

    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: makeNavigationState(),
        handledRequestKey: null,
        shipment,
        preferredContainerNumber: 'MSCU1234567',
        selectedContainer: shipment.containers[0] ?? null,
        isTrackingTimeTravelActive: true,
      }),
    ).toBe('close-live-status')
  })

  it('waits until the preferred container selection is applied', () => {
    const shipment = makeShipment([
      makeContainer('container-1', 'MSCU1234567'),
      makeContainer('container-2', 'MSCU7654321'),
    ])

    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: makeNavigationState(),
        handledRequestKey: null,
        shipment,
        preferredContainerNumber: 'MSCU7654321',
        selectedContainer: shipment.containers[0] ?? null,
        isTrackingTimeTravelActive: false,
      }),
    ).toBe('wait')
  })

  it('scrolls once the preferred container is selected', () => {
    const shipment = makeShipment([
      makeContainer('container-1', 'MSCU1234567'),
      makeContainer('container-2', 'MSCU7654321'),
    ])

    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: makeNavigationState(),
        handledRequestKey: null,
        shipment,
        preferredContainerNumber: 'MSCU7654321',
        selectedContainer: shipment.containers[1] ?? null,
        isTrackingTimeTravelActive: false,
      }),
    ).toBe('scroll-current-status')
  })

  it('scrolls even when the preferred container no longer exists in the payload', () => {
    const shipment = makeShipment([makeContainer('container-1', 'MSCU1234567')])

    expect(
      resolveShipmentAlertNavigationAction({
        navigationState: makeNavigationState(),
        handledRequestKey: null,
        shipment,
        preferredContainerNumber: 'MSCU0000000',
        selectedContainer: shipment.containers[0] ?? null,
        isTrackingTimeTravelActive: false,
      }),
    ).toBe('scroll-current-status')
  })
})

describe('scrollShipmentCurrentStatusIntoView', () => {
  it('scrolls the current status section when it exists', () => {
    const scrollIntoView = vi.fn()

    expect(
      scrollShipmentCurrentStatusIntoView({
        getElementById: (id) =>
          id === SHIPMENT_CURRENT_STATUS_SECTION_ID ? { scrollIntoView } : null,
      }),
    ).toBe(true)

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    })
  })

  it('returns false when the current status section does not exist', () => {
    expect(
      scrollShipmentCurrentStatusIntoView({
        getElementById: () => null,
      }),
    ).toBe(false)
  })
})
