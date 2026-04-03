import { describe, expect, it } from 'vitest'
import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`)
  }
  return item
}

type ContainerOperationalResponse = NonNullable<
  ProcessDetailResponse['containers'][number]['operational']
>
type OperationalCurrentContextResponse = ContainerOperationalResponse['current_context']
type OperationalNextLocationResponse = NonNullable<ContainerOperationalResponse['next_location']>

function makeCurrentContext(
  overrides: Partial<OperationalCurrentContextResponse> = {},
): OperationalCurrentContextResponse {
  return {
    location_code: 'BRSSZ',
    location_display: 'Santos',
    vessel_name: 'CMA CGM KRYPTON',
    voyage: 'VCGK0001W',
    vessel_visible: true,
    ...overrides,
  }
}

function makeNextLocation(
  overrides: Partial<OperationalNextLocationResponse> = {},
): OperationalNextLocationResponse {
  return {
    event_time: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
    event_time_type: 'EXPECTED',
    type: 'DISCHARGE',
    location_code: 'BRSSZ',
    location_display: 'Santos',
    ...overrides,
  }
}

function makeContainerOperational(
  overrides: Partial<ContainerOperationalResponse> & {
    readonly eta?: ContainerOperationalResponse['eta']
    readonly eta_display?: ContainerOperationalResponse['eta_display']
    readonly current_context?: OperationalCurrentContextResponse
    readonly next_location?: ContainerOperationalResponse['next_location']
  } = {},
): ContainerOperationalResponse {
  return {
    status: 'IN_TRANSIT',
    eta: null,
    eta_display: {
      kind: 'unavailable',
    },
    current_context: makeCurrentContext(),
    next_location: null,
    transshipment: {
      has_transshipment: false,
      count: 0,
      ports: [],
    },
    data_issue: false,
    ...overrides,
  }
}

describe('toShipmentDetailVM base mapping', () => {
  it('maps a minimal API payload into shipment detail view model', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-1',
      tracking_freshness_token: 'token-proc-1',
      reference: 'REF-1',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'maersk',
      bill_of_lading: null,
      booking_number: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c1',
          container_number: 'MRKU1234567',
          carrier_code: 'MAERSK',
          status: 'LOADED',
          timeline: [
            {
              id: 'timeline-1',
              observation_id: 'obs-1',
              type: 'LOAD',
              carrier_label: 'Loaded',
              location: 'Shanghai',
              event_time: temporalDtoFromCanonical('2026-02-01T10:00:00.000Z'),
              event_time_type: 'ACTUAL',
              derived_state: 'ACTUAL',
              vessel_name: 'MAERSK SEVILLE',
              voyage: '123W',
              has_series_history: false,
              series_history: null,
            },
          ],
        },
      ],
      containersSync: [],
      alerts: [],
    }

    const result = toShipmentDetailVM(example)
    const firstContainer = requireAt(result.containers, 0)
    const firstTimelineItem = requireAt(firstContainer.timeline, 0)
    expect(result).toBeTruthy()
    expect(result.id).toBe('proc-1')
    expect(result.trackingFreshnessToken).toBe('token-proc-1')
    expect(Array.isArray(result.containers)).toBe(true)
    expect(firstContainer.number).toBe('MRKU1234567')
    expect(firstContainer.status).toBe('indigo-500')
    expect(firstContainer.statusCode).toBe('LOADED')
    expect(firstContainer.timeline.length).toBe(1)
    expect(firstTimelineItem.type).toBe('LOAD')
    expect(firstTimelineItem.vesselName).toBe('MAERSK SEVILLE')
    expect(firstTimelineItem.voyage).toBe('123W')
    expect(firstTimelineItem.observationId).toBe('obs-1')
    expect(firstTimelineItem.hasSeriesHistory).toBe(false)
    expect(firstContainer.carrierCode).toBe('MAERSK')
    expect(firstContainer.sync.state).toBe('never')
    expect(firstContainer.etaChipVm.state).toBe('UNAVAILABLE')
    expect(firstContainer.dataIssueChipVm.visible).toBe(false)
    expect(result.processEtaDisplayVm.kind).toBe('unavailable')
    expect(result.processEtaSecondaryVm.visible).toBe(false)
    expect(result.processEtaSecondaryVm.total).toBe(1)
    expect(Array.isArray(result.alerts)).toBe(true)
  })

  it('maps process-level status and alerts from tracking data', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-2',
      tracking_freshness_token: 'token-proc-2',
      reference: 'REF-2',
      origin: { display_name: 'Rotterdam' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c2',
          container_number: 'MSCU1234567',
          status: 'IN_TRANSIT',
        },
      ],
      process_operational: {
        derived_status: 'IN_TRANSIT',
        status_microbadge: {
          status: 'DISCHARGED',
          count: 1,
        },
        eta_max: null,
        eta_display: {
          kind: 'unavailable',
        },
        coverage: {
          total: 1,
          with_eta: 0,
        },
      },
      containersSync: [],
      alerts: [
        {
          id: 'alert-1',
          container_number: 'MSCU1234567',
          category: 'fact',
          type: 'TRANSSHIPMENT',
          severity: 'warning',
          message_key: 'alerts.transshipmentDetected',
          message_params: {
            port: 'MAPTM02',
            fromVessel: 'MAERSK NARMADA',
            toVessel: 'CMA CGM LISA MARIE',
          },
          detected_at: new Date().toISOString(),
          triggered_at: '2026-02-01T10:00:00.000Z',
          retroactive: false,
          provider: 'msc',
          acked_at: null,
        },
      ],
    }

    const result = toShipmentDetailVM(example)
    const firstAlert = requireAt(result.alerts, 0)
    expect(result.status).toBe('blue-500')
    expect(result.statusCode).toBe('IN_TRANSIT')
    expect(result.statusMicrobadge).toEqual({
      statusCode: 'DISCHARGED',
      count: 1,
    })
    expect(result.alerts.length).toBe(1)
    expect(firstAlert.type).toBe('transshipment')
    expect(firstAlert.severity).toBe('warning')
    expect(firstAlert.category).toBe('fact')
    expect(firstAlert.triggeredAtIso).toBe('2026-02-01T10:00:00.000Z')
    expect(firstAlert.ackedAtIso).toBeNull()
    expect(firstAlert.containerNumber).toBe('MSCU1234567')
    expect(firstAlert.messageKey).toBe('alerts.transshipmentDetected')
    expect(result.processEtaDisplayVm.kind).toBe('unavailable')
  })

  it('keeps non-blank redestination_number values', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-redest',
      tracking_freshness_token: 'token-proc-redest',
      reference: 'REF-RED',
      origin: { display_name: 'Origin' },
      destination: { display_name: 'Destination' },
      carrier: null,
      bill_of_lading: null,
      booking_number: null,
      redestination_number: 'RD-12345',
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c-redest',
          container_number: 'MSCU7654321',
          status: 'IN_TRANSIT',
          timeline: [],
        },
      ],
      containersSync: [],
      alerts: [],
    }

    const result = toShipmentDetailVM(example)
    expect(result.redestination_number).toBe('RD-12345')
  })

  it('normalizes blank redestination_number values to null', () => {
    const makeExample = (redestination_number: string | null | undefined): ProcessDetailResponse => ({
      id: 'proc-redest-blank',
      tracking_freshness_token: 'token-proc-redest-blank',
      reference: 'REF-RED-BLANK',
      origin: { display_name: 'Origin' },
      destination: { display_name: 'Destination' },
      carrier: null,
      bill_of_lading: null,
      booking_number: null,
      redestination_number,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c-redest-blank',
          container_number: 'MSCU7654321',
          status: 'IN_TRANSIT',
          timeline: [],
        },
      ],
      containersSync: [],
      alerts: [],
    })

    const blankResult = toShipmentDetailVM(makeExample(''))
    const whitespaceResult = toShipmentDetailVM(makeExample('   '))

    expect(blankResult.redestination_number).toBeNull()
    expect(whitespaceResult.redestination_number).toBeNull()
  })
})

describe('toShipmentDetailVM tracking mapping', () => {
  it('maps compact shipment alert incidents when the additive payload is present', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-incident',
      tracking_freshness_token: 'token-proc-incident',
      reference: 'REF-INCIDENT',
      origin: { display_name: 'Busan' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'container-1',
          container_number: 'FCIU2000205',
        },
      ],
      containersSync: [],
      alerts: [],
      alert_incidents: {
        summary: {
          active_incidents: 1,
          affected_containers: 1,
          recognized_incidents: 0,
        },
        active: [
          {
            incident_key: 'TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
            bucket: 'active',
            category: 'movement',
            type: 'TRANSSHIPMENT',
            severity: 'warning',
            message_key: 'alerts.transshipmentDetected',
            message_params: {
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
            },
            detected_at: '2026-02-28T00:00:00.000Z',
            triggered_at: '2026-03-30T10:01:00.000Z',
            threshold_days: null,
            days_without_movement: null,
            last_event_date: null,
            transshipment_order: 1,
            port: 'KRPUS',
            from_vessel: 'MSC IRIS',
            to_vessel: 'MSC BIANCA SILVIA',
            affected_container_count: 1,
            active_alert_ids: ['alert-1'],
            acked_alert_ids: [],
            members: [
              {
                container_id: 'container-1',
                container_number: 'FCIU2000205',
                lifecycle_state: 'ACTIVE',
                detected_at: '2026-02-28T00:00:00.000Z',
                threshold_days: null,
                days_without_movement: null,
                last_event_date: null,
                transshipment_order: 1,
                port: 'KRPUS',
                from_vessel: 'MSC IRIS',
                to_vessel: 'MSC BIANCA SILVIA',
                records: [
                  {
                    alert_id: 'alert-1',
                    lifecycle_state: 'ACTIVE',
                    detected_at: '2026-02-28T00:00:00.000Z',
                    triggered_at: '2026-03-30T10:01:00.000Z',
                    acked_at: null,
                    resolved_at: null,
                    resolved_reason: null,
                    threshold_days: null,
                    days_without_movement: null,
                    last_event_date: null,
                  },
                ],
              },
            ],
            monitoring_history: [],
          },
        ],
        recognized: [],
      },
    }

    const result = toShipmentDetailVM(example)
    expect(result.alertIncidents.summary.activeIncidents).toBe(1)
    expect(result.alertIncidents.active[0]?.incidentKey).toBe(
      'TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
    )
    expect(result.alertIncidents.active[0]?.detectedAtIso).toBe('2026-02-28T00:00:00.000Z')
    expect(result.alertIncidents.active[0]?.members[0]?.containerNumber).toBe('FCIU2000205')
    expect(result.alertIncidents.active[0]?.members[0]?.detectedAtIso).toBe(
      '2026-02-28T00:00:00.000Z',
    )
  })

  it('maps container sync metadata by normalized container number', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-sync',
      tracking_freshness_token: 'token-proc-sync',
      reference: 'REF-SYNC',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c-sync',
          container_number: 'MSCU8888888',
          carrier_code: 'MSC',
          status: 'IN_TRANSIT',
        },
      ],
      containersSync: [
        {
          containerNumber: '  mscu8888888 ',
          carrier: 'maersk',
          lastSuccessAt: '2026-02-01T10:00:00.000Z',
          lastAttemptAt: '2026-02-02T10:00:00.000Z',
          isSyncing: false,
          lastErrorCode: 'timeout',
          lastErrorAt: '2026-02-03T10:00:00.000Z',
        },
      ],
      alerts: [],
    }

    const result = toShipmentDetailVM(example, 'en-US')
    const firstContainer = requireAt(result.containers, 0)
    expect(firstContainer.sync.state).toBe('error')
    expect(firstContainer.sync.carrier).toBe('maersk')
  })
})

describe('toShipmentDetailVM fallback mapping', () => {
  it('keeps acknowledged alerts and exposes ackedAtIso', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-3',
      tracking_freshness_token: 'token-proc-3',
      reference: null,
      origin: null,
      destination: null,
      carrier: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [{ id: 'c3', container_number: 'TEST1234567' }],
      containersSync: [],
      alerts: [
        {
          id: 'alert-acked',
          container_number: 'TEST1234567',
          category: 'monitoring',
          type: 'NO_MOVEMENT',
          severity: 'warning',
          message_key: 'alerts.noMovementDetected',
          message_params: {
            threshold_days: 10,
            days_without_movement: 10,
            days: 10,
            lastEventDate: '2026-02-24',
          },
          detected_at: new Date().toISOString(),
          triggered_at: new Date().toISOString(),
          retroactive: false,
          provider: null,
          acked_at: '2026-03-05T12:00:00.000Z',
        },
      ],
    }

    const result = toShipmentDetailVM(example)
    const firstAlert = requireAt(result.alerts, 0)
    expect(result.alerts.length).toBe(1)
    expect(firstAlert.ackedAtIso).toBe('2026-03-05T12:00:00.000Z')
  })

  it('shows placeholder timeline when no observations', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-4',
      tracking_freshness_token: 'token-proc-4',
      reference: 'EMPTY',
      origin: null,
      destination: null,
      carrier: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c4',
          container_number: 'NONE1234567',
          status: 'UNKNOWN',
        },
      ],
      containersSync: [],
      alerts: [],
    }

    const result = toShipmentDetailVM(example)
    const firstContainer = requireAt(result.containers, 0)
    const firstTimelineItem = requireAt(firstContainer.timeline, 0)
    expect(firstContainer.timeline.length).toBe(1)
    expect(firstTimelineItem.id).toBe('system-created')
    expect(firstContainer.status).toBe('slate-400')
  })
})

function createOperationalMultiContainerResponse(): ProcessDetailResponse {
  return {
    id: 'proc-5',
    tracking_freshness_token: 'token-proc-5',
    reference: 'OPS-5',
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    source: 'api',
    created_at: '2026-02-01T10:00:00.000Z',
    updated_at: '2026-02-01T10:00:00.000Z',
    containers: [
      {
        id: 'c5-1',
        container_number: 'MSCU1111111',
        status: 'IN_TRANSIT',
        operational: makeContainerOperational({
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-02-20T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'EXPIRED_EXPECTED',
            type: 'ARRIVAL',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
          eta_display: {
            kind: 'date',
            value: temporalDtoFromCanonical('2026-02-20T10:00:00.000Z'),
          },
          current_context: makeCurrentContext(),
          next_location: makeNextLocation({
            event_time: temporalDtoFromCanonical('2026-02-20T10:00:00.000Z'),
            type: 'ARRIVAL',
          }),
          transshipment: {
            has_transshipment: true,
            count: 2,
            ports: [
              { code: 'ESALG', display: 'Algeciras' },
              { code: 'ITGIT', display: 'Gioia Tauro' },
            ],
          },
          data_issue: true,
        }),
      },
      {
        id: 'c5-2',
        container_number: 'MSCU2222222',
        status: 'IN_TRANSIT',
        operational: makeContainerOperational({
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'DISCHARGE',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
          eta_display: {
            kind: 'date',
            value: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
          },
          current_context: makeCurrentContext(),
          next_location: makeNextLocation({
            event_time: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
          }),
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        }),
      },
    ],
    containersSync: [],
    alerts: [],
    process_operational: {
      derived_status: 'IN_TRANSIT',
      eta_max: {
        event_time: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        state: 'ACTIVE_EXPECTED',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'Santos',
      },
      eta_display: {
        kind: 'date',
        value: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
      },
      coverage: {
        total: 2,
        with_eta: 1,
      },
    },
  }
}

function createOperationalHiddenIntResponse(): ProcessDetailResponse {
  return {
    id: 'proc-6',
    tracking_freshness_token: 'token-proc-6',
    reference: 'OPS-6',
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    source: 'api',
    created_at: '2026-02-01T10:00:00.000Z',
    updated_at: '2026-02-01T10:00:00.000Z',
    containers: [
      {
        id: 'c6-1',
        container_number: 'MSCU3333333',
        status: 'IN_TRANSIT',
        operational: makeContainerOperational({
          status: 'IN_TRANSIT',
          eta: null,
          eta_display: {
            kind: 'unavailable',
          },
          current_context: makeCurrentContext(),
          next_location: null,
          transshipment: {
            has_transshipment: false,
            count: 2,
            ports: [
              { code: 'EGPSDTM', display: 'Port Said' },
              { code: 'ESBCN07', display: 'Barcelona' },
            ],
          },
          data_issue: false,
        }),
      },
    ],
    containersSync: [],
    alerts: [],
  }
}

function createOperationalFullCoverageResponse(): ProcessDetailResponse {
  return {
    id: 'proc-7',
    tracking_freshness_token: 'token-proc-7',
    reference: 'OPS-7',
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    source: 'api',
    created_at: '2026-02-01T10:00:00.000Z',
    updated_at: '2026-02-01T10:00:00.000Z',
    containers: [
      {
        id: 'c7-1',
        container_number: 'MSCU4444444',
        status: 'IN_TRANSIT',
        operational: makeContainerOperational({
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-03-05T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'ARRIVAL',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
          eta_display: {
            kind: 'date',
            value: temporalDtoFromCanonical('2026-03-05T10:00:00.000Z'),
          },
          current_context: makeCurrentContext(),
          next_location: makeNextLocation({
            event_time: temporalDtoFromCanonical('2026-03-05T10:00:00.000Z'),
            type: 'ARRIVAL',
          }),
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        }),
      },
      {
        id: 'c7-2',
        container_number: 'MSCU5555555',
        status: 'IN_TRANSIT',
        operational: makeContainerOperational({
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'ARRIVAL',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
          eta_display: {
            kind: 'date',
            value: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
          },
          current_context: makeCurrentContext(),
          next_location: makeNextLocation({
            event_time: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
            type: 'ARRIVAL',
          }),
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        }),
      },
    ],
    containersSync: [],
    alerts: [],
    process_operational: {
      derived_status: 'IN_TRANSIT',
      eta_max: {
        event_time: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        state: 'ACTIVE_EXPECTED',
        type: 'ARRIVAL',
        location_code: 'BRSSZ',
        location_display: 'Santos',
      },
      eta_display: {
        kind: 'date',
        value: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
      },
      coverage: {
        total: 2,
        with_eta: 2,
      },
    },
  }
}

describe('toShipmentDetailVM operational mapping', () => {
  it('maps ETA and transshipment operational chips for multi-container view', () => {
    const result = toShipmentDetailVM(createOperationalMultiContainerResponse(), 'pt-BR')
    const firstContainer = requireAt(result.containers, 0)
    const secondContainer = requireAt(result.containers, 1)

    expect(firstContainer.etaChipVm.state).toBe('EXPIRED_EXPECTED')
    expect(firstContainer.tsChipVm.visible).toBe(true)
    expect(firstContainer.tsChipVm.count).toBe(2)
    expect(firstContainer.dataIssueChipVm.visible).toBe(true)
    expect(secondContainer.tsChipVm.visible).toBe(false)
    expect(result.processEtaDisplayVm.kind).toBe('date')
    expect(result.processEtaSecondaryVm.visible).toBe(true)
    expect(result.processEtaSecondaryVm.total).toBe(2)
    expect(result.processEtaSecondaryVm.withEta).toBe(1)
    expect(result.processEtaSecondaryVm.incomplete).toBe(true)
  })

  it('maps delivered ETA display for terminal process and container states', () => {
    const result = toShipmentDetailVM(createDeliveredOperationalResponse(), 'pt-BR')
    const firstContainer = requireAt(result.containers, 0)

    expect(firstContainer.etaChipVm.state).toBe('DELIVERED')
    expect(firstContainer.selectedEtaVm).toBeNull()
    expect(result.processEtaDisplayVm).toEqual({
      kind: 'delivered',
    })
    expect(result.eta).toBeNull()
  })

  it('maps arrived process ETA display with a resolved arrival date', () => {
    const result = toShipmentDetailVM(createArrivedOperationalResponse(), 'pt-BR')

    expect(result.processEtaDisplayVm).toEqual({
      kind: 'arrived',
      date: '28/03/2026',
    })
    expect(result.eta).toBe('28/03/2026')
    expect(result.processEtaSecondaryVm.date).toBe('28/03/2026')
  })

  it('keeps INT chip hidden when transshipment flag is false even with count > 0', () => {
    const result = toShipmentDetailVM(createOperationalHiddenIntResponse(), 'pt-BR')
    const firstContainer = requireAt(result.containers, 0)
    expect(firstContainer.tsChipVm.visible).toBe(false)
    expect(firstContainer.tsChipVm.count).toBe(2)
  })

  it('marks process ETA coverage as complete when all containers have ETA', () => {
    const result = toShipmentDetailVM(createOperationalFullCoverageResponse(), 'pt-BR')
    expect(result.processEtaSecondaryVm.visible).toBe(true)
    expect(result.processEtaSecondaryVm.withEta).toBe(2)
    expect(result.processEtaSecondaryVm.total).toBe(2)
    expect(result.processEtaSecondaryVm.incomplete).toBe(false)
  })
})

function createDeliveredOperationalResponse(): ProcessDetailResponse {
  return {
    id: 'proc-delivered',
    tracking_freshness_token: 'token-proc-delivered',
    reference: 'OPS-DELIVERED',
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    source: 'api',
    created_at: '2026-02-01T10:00:00.000Z',
    updated_at: '2026-02-01T10:00:00.000Z',
    containers: [
      {
        id: 'c-delivered-1',
        container_number: 'MSCU9999999',
        status: 'EMPTY_RETURNED',
        operational: {
          status: 'EMPTY_RETURNED',
          eta: null,
          eta_display: {
            kind: 'delivered',
          },
          eta_applicable: false,
          lifecycle_bucket: 'final_delivery',
          current_context: makeCurrentContext({
            location_code: 'BRSSZ',
            location_display: 'Santos',
            vessel_name: null,
            voyage: null,
            vessel_visible: false,
          }),
          next_location: null,
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        },
      },
    ],
    containersSync: [],
    alerts: [],
    process_operational: {
      derived_status: 'DELIVERED',
      eta_max: null,
      eta_display: {
        kind: 'delivered',
      },
      coverage: {
        total: 1,
        with_eta: 0,
      },
      lifecycle_bucket: 'final_delivery',
      final_delivery_complete: true,
      full_logistics_complete: true,
    },
  }
}

function createArrivedOperationalResponse(): ProcessDetailResponse {
  return {
    id: 'proc-arrived-eta',
    tracking_freshness_token: 'token-proc-arrived-eta',
    reference: 'OPS-ARRIVED',
    origin: { display_name: 'Karachi' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    source: 'api',
    created_at: '2026-02-01T10:00:00.000Z',
    updated_at: '2026-02-01T10:00:00.000Z',
    containers: [
      {
        id: 'c-arrived-eta-1',
        container_number: 'FCIU2000205',
        status: 'LOADED',
      },
    ],
    containersSync: [],
    alerts: [],
    process_operational: {
      derived_status: 'IN_TRANSIT',
      eta_max: {
        event_time: temporalDtoFromCanonical('2026-03-28'),
        event_time_type: 'ACTUAL',
        state: 'ACTUAL',
        type: 'DISCHARGE',
        location_code: 'LKCMB',
        location_display: 'Colombo',
      },
      eta_display: {
        kind: 'arrived',
        value: temporalDtoFromCanonical('2026-03-28'),
      },
      coverage: {
        total: 1,
        with_eta: 1,
      },
    },
  }
}
