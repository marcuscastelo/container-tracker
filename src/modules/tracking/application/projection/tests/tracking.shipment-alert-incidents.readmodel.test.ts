import { describe, expect, it } from 'vitest'
import { buildShipmentAlertIncidentsReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

function toIncidentOrder(incidentKey: string): number | null {
  const [, maybeOrder] = incidentKey.split(':')
  const order = Number(maybeOrder ?? '')
  return Number.isInteger(order) && order > 0 ? order : null
}

function toFactStringParam(params: Record<string, string | number>, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' ? value : null
}

function makeTransshipmentAlert(command: {
  readonly id: string
  readonly containerId: string
  readonly port: string
  readonly fromVessel: string
  readonly toVessel: string
  readonly detectedAt: string
  readonly triggeredAt: string
  readonly fingerprint: string
  readonly ackedAt?: string | null
  readonly resolvedAt?: string | null
  readonly lifecycleState?: 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
}): TrackingAlert {
  return {
    ...(command.lifecycleState === undefined ? {} : { lifecycle_state: command.lifecycleState }),
    id: command.id,
    container_id: command.containerId,
    category: 'fact',
    type: 'TRANSSHIPMENT',
    severity: 'warning',
    message_key: 'alerts.transshipmentDetected',
    message_params: {
      port: command.port,
      fromVessel: command.fromVessel,
      toVessel: command.toVessel,
    },
    detected_at: command.detectedAt,
    triggered_at: command.triggeredAt,
    source_observation_fingerprints: [`${command.fingerprint}-d`, `${command.fingerprint}-l`],
    alert_fingerprint: command.fingerprint,
    retroactive: false,
    provider: null,
    acked_at: command.ackedAt ?? null,
    acked_by: null,
    acked_source: null,
    resolved_at: command.resolvedAt ?? null,
    resolved_reason: null,
  }
}

function makeEtaPassedAlert(command: {
  readonly id: string
  readonly containerId: string
  readonly triggeredAt: string
  readonly ackedAt?: string | null
  readonly resolvedAt?: string | null
  readonly lifecycleState?: 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
}): TrackingAlert {
  return {
    ...(command.lifecycleState === undefined ? {} : { lifecycle_state: command.lifecycleState }),
    id: command.id,
    container_id: command.containerId,
    category: 'monitoring',
    type: 'ETA_PASSED',
    severity: 'warning',
    message_key: 'alerts.etaPassed',
    message_params: {},
    detected_at: command.triggeredAt,
    triggered_at: command.triggeredAt,
    source_observation_fingerprints: [`eta-${command.id}`],
    alert_fingerprint: `eta-passed-${command.containerId}`,
    retroactive: false,
    provider: null,
    acked_at: command.ackedAt ?? null,
    acked_by: null,
    acked_source: null,
    resolved_at: command.resolvedAt ?? null,
    resolved_reason: command.resolvedAt ? 'condition_cleared' : null,
  }
}

function makeCustomsHoldAlert(command: {
  readonly id: string
  readonly containerId: string
  readonly location: string
  readonly triggeredAt: string
  readonly ackedAt?: string | null
  readonly lifecycleState?: 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
}): TrackingAlert {
  return {
    ...(command.lifecycleState === undefined ? {} : { lifecycle_state: command.lifecycleState }),
    id: command.id,
    container_id: command.containerId,
    category: 'fact',
    type: 'CUSTOMS_HOLD',
    severity: 'danger',
    message_key: 'alerts.customsHoldDetected',
    message_params: {
      location: command.location,
    },
    detected_at: command.triggeredAt,
    triggered_at: command.triggeredAt,
    source_observation_fingerprints: [`customs-${command.id}`],
    alert_fingerprint: `customs-${command.location}`,
    retroactive: false,
    provider: null,
    acked_at: command.ackedAt ?? null,
    acked_by: null,
    acked_source: null,
    resolved_at: null,
    resolved_reason: null,
  }
}

describe('tracking.shipment-alert-incidents.readmodel', () => {
  it('groups identical transshipments into one active incident', () => {
    const result = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'FCIU2000205',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-1',
              containerId: 'container-1',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:00:00.000Z',
              triggeredAt: '2026-03-30T10:01:00.000Z',
              fingerprint: 'ts-a',
            }),
          ],
        },
        {
          containerId: 'container-2',
          containerNumber: 'CAIU6241835',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-2',
              containerId: 'container-2',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:03:00.000Z',
              triggeredAt: '2026-03-30T10:04:00.000Z',
              fingerprint: 'ts-b',
            }),
          ],
        },
        {
          containerId: 'container-3',
          containerNumber: 'MSDU1652364',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-3',
              containerId: 'container-3',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:05:00.000Z',
              triggeredAt: '2026-03-30T10:06:00.000Z',
              fingerprint: 'ts-c',
            }),
          ],
        },
      ],
    })

    expect(result.summary.activeIncidentCount).toBe(1)
    expect(result.summary.affectedContainerCount).toBe(3)
    expect(result.active[0]?.type).toBe('TRANSSHIPMENT')
    expect(result.active[0]?.incidentKey).toBe('TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA')
    expect(result.active[0]?.scope.affectedContainerCount).toBe(3)
    expect(toIncidentOrder(result.active[0]?.incidentKey ?? '')).toBe(1)
    expect(result.active[0]?.detectedAt).toBe('2026-03-30T10:00:00.000Z')
    expect(result.active[0]?.members.map((member) => member.containerNumber)).toEqual([
      'CAIU6241835',
      'FCIU2000205',
      'MSDU1652364',
    ])
    expect(result.active[0]?.members[0]?.detectedAt).toBe('2026-03-30T10:03:00.000Z')
    expect(result.active[0]?.members[0]?.records[0]?.detectedAt).toBe('2026-03-30T10:03:00.000Z')
  })

  it('separates transshipments when the route diverges', () => {
    const result = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'FCIU2000205',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-1',
              containerId: 'container-1',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:00:00.000Z',
              triggeredAt: '2026-03-30T10:01:00.000Z',
              fingerprint: 'ts-a',
            }),
          ],
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSBU3493578',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-2',
              containerId: 'container-2',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'FEEDER ALPHA',
              detectedAt: '2026-03-30T10:03:00.000Z',
              triggeredAt: '2026-03-30T10:04:00.000Z',
              fingerprint: 'ts-b',
            }),
          ],
        },
      ],
    })

    expect(result.summary.activeIncidentCount).toBe(2)
    expect(
      result.active.map((incident) => toFactStringParam(incident.fact.messageParams, 'toVessel')),
    ).toEqual(['FEEDER ALPHA', 'MSC BIANCA SILVIA'])
  })

  it('separates transshipments when the same vessel change occurs in a different order', () => {
    const result = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'FCIU2000205',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-1',
              containerId: 'container-1',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:00:00.000Z',
              triggeredAt: '2026-03-30T10:01:00.000Z',
              fingerprint: 'ts-a',
            }),
            makeTransshipmentAlert({
              id: 'alert-2',
              containerId: 'container-1',
              port: 'SGSIN',
              fromVessel: 'MSC BIANCA SILVIA',
              toVessel: 'FEEDER XYZ',
              detectedAt: '2026-04-01T10:00:00.000Z',
              triggeredAt: '2026-04-01T10:01:00.000Z',
              fingerprint: 'ts-b',
            }),
          ],
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSBU3493578',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-3',
              containerId: 'container-2',
              port: 'SGSIN',
              fromVessel: 'MSC BIANCA SILVIA',
              toVessel: 'FEEDER XYZ',
              detectedAt: '2026-03-30T09:00:00.000Z',
              triggeredAt: '2026-03-30T09:01:00.000Z',
              fingerprint: 'ts-c',
            }),
          ],
        },
      ],
    })

    const singaporeIncidents = result.active.filter(
      (incident) => toFactStringParam(incident.fact.messageParams, 'port') === 'SGSIN',
    )
    expect(singaporeIncidents).toHaveLength(2)
    expect(singaporeIncidents.map((incident) => toIncidentOrder(incident.incidentKey))).toEqual([
      2, 1,
    ])
  })

  it('groups eta-passed alerts into one active incident per type', () => {
    const result = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'MSDU1652364',
          alerts: [
            makeEtaPassedAlert({
              id: 'alert-eta-1',
              containerId: 'container-1',
              triggeredAt: '2026-03-20T12:00:00.000Z',
              lifecycleState: 'ACTIVE',
            }),
          ],
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSBU3493578',
          alerts: [
            makeEtaPassedAlert({
              id: 'alert-eta-2',
              containerId: 'container-2',
              triggeredAt: '2026-03-21T12:00:00.000Z',
              lifecycleState: 'ACTIVE',
            }),
          ],
        },
      ],
    })

    expect(result.summary.activeIncidentCount).toBe(1)
    expect(result.summary.affectedContainerCount).toBe(2)
    expect(result.active[0]?.type).toBe('ETA_PASSED')
    expect(result.active[0]?.category).toBe('eta')
    expect(result.active[0]?.scope.affectedContainerCount).toBe(2)
    expect(
      result.active[0]?.members.flatMap((member) => member.records.map((record) => record.alertId)),
    ).toEqual(['alert-eta-2', 'alert-eta-1'])
  })

  it('places acknowledged and auto-resolved incidents in the recognized bucket', () => {
    const result = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'MSDU1652364',
          alerts: [
            makeCustomsHoldAlert({
              id: 'alert-customs',
              containerId: 'container-1',
              location: 'Santos',
              triggeredAt: '2026-03-01T12:00:00.000Z',
              ackedAt: '2026-03-02T12:00:00.000Z',
              lifecycleState: 'ACKED',
            }),
          ],
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSBU3493578',
          alerts: [
            makeEtaPassedAlert({
              id: 'alert-auto-resolved',
              containerId: 'container-2',
              triggeredAt: '2026-03-30T12:00:00.000Z',
              resolvedAt: '2026-03-31T12:00:00.000Z',
              lifecycleState: 'AUTO_RESOLVED',
            }),
          ],
        },
      ],
    })

    expect(result.summary.activeIncidentCount).toBe(0)
    expect(result.summary.recognizedIncidentCount).toBe(2)
    expect(result.recognized.map((incident) => incident.bucket)).toEqual([
      'recognized',
      'recognized',
    ])
    expect(
      result.recognized
        .flatMap((incident) => incident.members.map((member) => member.lifecycleState))
        .sort(),
    ).toEqual(['ACKED', 'AUTO_RESOLVED'])
  })

  it('splits the same semantic incident into active and recognized buckets when lifecycles differ', () => {
    const result = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'FCIU2000205',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-active',
              containerId: 'container-1',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:00:00.000Z',
              triggeredAt: '2026-03-30T10:01:00.000Z',
              fingerprint: 'ts-active',
              lifecycleState: 'ACTIVE',
            }),
          ],
        },
        {
          containerId: 'container-2',
          containerNumber: 'CAIU6241835',
          alerts: [
            makeTransshipmentAlert({
              id: 'alert-acked',
              containerId: 'container-2',
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
              detectedAt: '2026-03-30T10:02:00.000Z',
              triggeredAt: '2026-03-30T10:03:00.000Z',
              fingerprint: 'ts-acked',
              ackedAt: '2026-03-31T10:00:00.000Z',
              lifecycleState: 'ACKED',
            }),
          ],
        },
      ],
    })

    expect(result.summary.activeIncidentCount).toBe(1)
    expect(result.summary.recognizedIncidentCount).toBe(1)
    expect(result.active[0]?.members.map((member) => member.lifecycleState)).toEqual(['ACTIVE'])
    expect(result.recognized[0]?.members.map((member) => member.lifecycleState)).toEqual(['ACKED'])
  })
})
