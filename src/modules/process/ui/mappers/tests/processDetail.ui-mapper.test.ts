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

describe('toShipmentDetailVM base mapping', () => {
  it('maps a minimal API payload into shipment detail view model', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-1',
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
          observations: [
            {
              id: 'obs-1',
              fingerprint: 'abc123',
              type: 'LOAD',
              event_time: temporalDtoFromCanonical('2026-02-01T10:00:00.000Z'),
              event_time_type: 'ACTUAL',
              location_code: 'CNSHA',
              location_display: 'Shanghai',
              vessel_name: 'MAERSK SEVILLE',
              voyage: '123W',
              is_empty: false,
              confidence: 'confirmed',
              provider: 'maersk',
              created_from_snapshot_id: 'snapshot-001',
              retroactive: false,
              created_at: new Date().toISOString(),
            },
          ],
          timeline: [
            {
              id: 'timeline-1',
              type: 'LOAD',
              carrier_label: 'Loaded',
              location: 'Shanghai',
              event_time: temporalDtoFromCanonical('2026-02-01T10:00:00.000Z'),
              event_time_type: 'ACTUAL',
              derived_state: 'ACTUAL',
              vessel_name: 'MAERSK SEVILLE',
              voyage: '123W',
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
    const firstObservation = requireAt(firstContainer.observations, 0)
    expect(result).toBeTruthy()
    expect(result.id).toBe('proc-1')
    expect(Array.isArray(result.containers)).toBe(true)
    expect(firstContainer.number).toBe('MRKU1234567')
    expect(firstContainer.status).toBe('indigo-500')
    expect(firstContainer.statusCode).toBe('LOADED')
    expect(firstContainer.timeline.length).toBe(1)
    expect(firstTimelineItem.type).toBe('LOAD')
    expect(firstTimelineItem.vesselName).toBe('MAERSK SEVILLE')
    expect(firstTimelineItem.voyage).toBe('123W')
    expect(firstContainer.observations.length).toBe(1)
    expect(firstObservation).toMatchObject({
      id: 'obs-1',
      type: 'LOAD',
      isEmpty: false,
      provider: 'maersk',
      createdFromSnapshotId: 'snapshot-001',
    })
    expect(firstContainer.carrierCode).toBe('MAERSK')
    expect(firstContainer.sync.state).toBe('never')
    expect(firstContainer.etaChipVm.state).toBe('UNAVAILABLE')
    expect(firstContainer.dataIssueChipVm.visible).toBe(false)
    expect(result.processEtaSecondaryVm.visible).toBe(false)
    expect(result.processEtaSecondaryVm.total).toBe(1)
    expect(Array.isArray(result.alerts)).toBe(true)
  })

  it('maps process-level status and alerts from tracking data', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-2',
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
          observations: [],
        },
      ],
      process_operational: {
        derived_status: 'IN_TRANSIT',
        status_microbadge: {
          status: 'DISCHARGED',
          count: 1,
        },
        eta_max: null,
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
  })
})

describe('toShipmentDetailVM tracking mapping', () => {
  it('maps compact shipment alert incidents when the additive payload is present', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-incident',
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
          observations: [],
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
          observations: [],
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
          observations: [],
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
        observations: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-02-20T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'EXPIRED_EXPECTED',
            type: 'ARRIVAL',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
          transshipment: {
            has_transshipment: true,
            count: 2,
            ports: [
              { code: 'ESALG', display: 'Algeciras' },
              { code: 'ITGIT', display: 'Gioia Tauro' },
            ],
          },
          data_issue: true,
        },
      },
      {
        id: 'c5-2',
        container_number: 'MSCU2222222',
        status: 'IN_TRANSIT',
        observations: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'DISCHARGE',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
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
      derived_status: 'IN_TRANSIT',
      eta_max: {
        event_time: temporalDtoFromCanonical('2026-02-25T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        state: 'ACTIVE_EXPECTED',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'Santos',
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
        observations: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: null,
          transshipment: {
            has_transshipment: false,
            count: 2,
            ports: [
              { code: 'EGPSDTM', display: 'Port Said' },
              { code: 'ESBCN07', display: 'Barcelona' },
            ],
          },
          data_issue: false,
        },
      },
    ],
    containersSync: [],
    alerts: [],
  }
}

function createOperationalFullCoverageResponse(): ProcessDetailResponse {
  return {
    id: 'proc-7',
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
        observations: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-03-05T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'ARRIVAL',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        },
      },
      {
        id: 'c7-2',
        container_number: 'MSCU5555555',
        status: 'IN_TRANSIT',
        observations: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: {
            event_time: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
            event_time_type: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'ARRIVAL',
            location_code: 'BRSSZ',
            location_display: 'Santos',
          },
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
      derived_status: 'IN_TRANSIT',
      eta_max: {
        event_time: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        state: 'ACTIVE_EXPECTED',
        type: 'ARRIVAL',
        location_code: 'BRSSZ',
        location_display: 'Santos',
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
    expect(result.processEtaSecondaryVm.visible).toBe(true)
    expect(result.processEtaSecondaryVm.total).toBe(2)
    expect(result.processEtaSecondaryVm.withEta).toBe(1)
    expect(result.processEtaSecondaryVm.incomplete).toBe(true)
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
