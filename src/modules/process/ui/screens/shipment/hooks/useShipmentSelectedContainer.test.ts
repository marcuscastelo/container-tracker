import { describe, expect, it, vi } from 'vitest'

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

import { createRoot, createSignal } from 'solid-js'
import { useShipmentSelectedContainer } from '~/modules/process/ui/screens/shipment/hooks/useShipmentSelectedContainer'
import type {
  ContainerDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'

function emptyAlertIncidents(): ShipmentDetailVM['alertIncidents'] {
  return {
    summary: {
      activeIncidents: 0,
      affectedContainers: 0,
      recognizedIncidents: 0,
    },
    active: [],
    recognized: [],
  }
}

function buildContainer(command: {
  readonly id: string
  readonly number: string
  readonly etaDate: string
}): ContainerDetailVM {
  return {
    id: command.id,
    number: command.number,
    carrierCode: 'MSC',
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    sync: {
      containerNumber: command.number,
      carrier: 'MSC',
      state: 'ok',
      relativeTimeAt: null,
      isStale: false,
    },
    eta: command.etaDate,
    etaChipVm: {
      state: 'ACTIVE_EXPECTED',
      tone: 'informative',
      date: command.etaDate,
    },
    selectedEtaVm: {
      state: 'ACTIVE_EXPECTED',
      tone: 'informative',
      date: command.etaDate,
      type: 'ARRIVAL',
    },
    currentContext: {
      locationCode: null,
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: false,
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

function buildShipment(command: {
  readonly id: string
  readonly containers: readonly ContainerDetailVM[]
}): ShipmentDetailVM {
  return {
    id: command.id,
    trackingFreshnessToken: `freshness-${command.id}`,
    processRef: `REF-${command.id}`,
    reference: `REF-${command.id}`,
    carrier: 'MSC',
    bill_of_lading: null,
    booking_number: null,
    importer_name: null,
    exporter_name: null,
    reference_importer: null,
    depositary: null,
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
      total: command.containers.length,
      incomplete: command.containers.length > 0,
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    containers: command.containers,
    alerts: [],
    alertIncidents: emptyAlertIncidents(),
  }
}

function createSelectionHarness(command: {
  readonly shipment: ShipmentDetailVM | null | undefined
  readonly preferredContainerNumber: string | null
}) {
  return createRoot((dispose) => {
    const [shipment, setShipment] = createSignal(command.shipment)
    const [preferredContainerNumber, setPreferredContainerNumber] = createSignal(
      command.preferredContainerNumber,
    )
    const controller = useShipmentSelectedContainer({
      shipment,
      preferredContainerNumber,
    })

    return {
      controller,
      setShipment,
      setPreferredContainerNumber,
      dispose,
    }
  })
}

describe('useShipmentSelectedContainer', () => {
  it('selects the first container after shipment data loads and allows operator selection changes', async () => {
    const first = buildContainer({
      id: 'container-1',
      number: 'MSCU1234567',
      etaDate: '2026-04-10',
    })
    const second = buildContainer({
      id: 'container-2',
      number: 'MSCU7654321',
      etaDate: '2026-04-12',
    })
    const harness = createSelectionHarness({
      shipment: undefined,
      preferredContainerNumber: null,
    })

    expect(harness.controller.selectedContainer()).toBeNull()

    harness.setShipment(
      buildShipment({
        id: 'process-1',
        containers: [first, second],
      }),
    )
    await Promise.resolve()

    expect(harness.controller.selectedContainerId()).toBe('container-1')
    expect(harness.controller.selectedContainer()?.number).toBe('MSCU1234567')

    harness.controller.setSelectedContainerId('container-2')

    expect(harness.controller.selectedContainer()?.number).toBe('MSCU7654321')
    expect(harness.controller.selectedContainerEtaVm()).toEqual({
      state: 'ACTIVE_EXPECTED',
      tone: 'informative',
      date: '2026-04-12',
      type: 'ARRIVAL',
    })

    harness.dispose()
  })

  it('applies a preferred container number once per shipment and preserves selection on invalid preference', async () => {
    const first = buildContainer({
      id: 'container-1',
      number: 'MSCU1234567',
      etaDate: '2026-04-10',
    })
    const second = buildContainer({
      id: 'container-2',
      number: 'MSCU7654321',
      etaDate: '2026-04-12',
    })
    const harness = createSelectionHarness({
      shipment: buildShipment({
        id: 'process-1',
        containers: [first, second],
      }),
      preferredContainerNumber: ' mscu7654321 ',
    })

    await Promise.resolve()

    expect(harness.controller.selectedContainerId()).toBe('container-2')
    expect(harness.controller.selectedContainer()?.number).toBe('MSCU7654321')

    harness.controller.setSelectedContainerId('container-1')
    harness.setPreferredContainerNumber('unknown-container')
    await Promise.resolve()

    expect(harness.controller.selectedContainerId()).toBe('container-1')
    expect(harness.controller.selectedContainer()?.number).toBe('MSCU1234567')

    harness.dispose()
  })

  it('falls back to the first container when selected id is stale after shipment replacement', async () => {
    const harness = createSelectionHarness({
      shipment: buildShipment({
        id: 'process-1',
        containers: [
          buildContainer({
            id: 'container-1',
            number: 'MSCU1234567',
            etaDate: '2026-04-10',
          }),
        ],
      }),
      preferredContainerNumber: null,
    })

    await Promise.resolve()
    harness.controller.setSelectedContainerId('container-removed')
    harness.setShipment(
      buildShipment({
        id: 'process-2',
        containers: [
          buildContainer({
            id: 'container-3',
            number: 'MSCU3333333',
            etaDate: '2026-05-01',
          }),
        ],
      }),
    )
    await Promise.resolve()

    expect(harness.controller.selectedContainer()?.number).toBe('MSCU3333333')
    expect(harness.controller.selectedContainerEtaVm()?.date).toBe('2026-05-01')

    harness.dispose()
  })
})
