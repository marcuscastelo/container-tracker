import {
  resolveAlertLifecycleState,
  type TrackingAlert,
  type TrackingAlertLifecycleState,
  type TrackingAlertResolvedReason,
  type TrackingAlertType,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

export type OperationalIncidentCategory = 'movement' | 'eta' | 'customs' | 'data'
export type OperationalIncidentBucket = 'active' | 'recognized'
export type OperationalIncidentActionKind =
  | 'UPDATE_REDESTINATION'
  | 'CHECK_ETA'
  | 'FOLLOW_UP_CUSTOMS'
  | 'REVIEW_DATA'

export type OperationalIncidentRecordReadModel = {
  readonly alertId: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAt: string
  readonly triggeredAt: string
  readonly ackedAt: string | null
  readonly resolvedAt: string | null
  readonly resolvedReason: TrackingAlertResolvedReason | null
}

export type OperationalIncidentMemberReadModel = {
  readonly containerId: string
  readonly containerNumber: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAt: string
  readonly records: readonly OperationalIncidentRecordReadModel[]
}

export type OperationalIncidentReadModel = {
  readonly incidentKey: string
  readonly bucket: OperationalIncidentBucket
  readonly category: OperationalIncidentCategory
  readonly type: TrackingAlertType
  readonly severity: TrackingAlert['severity']
  readonly fact: {
    readonly messageKey:
      | 'incidents.fact.transshipmentDetected'
      | 'incidents.fact.plannedTransshipmentDetected'
      | 'incidents.fact.customsHoldDetected'
      | 'incidents.fact.etaPassed'
      | 'incidents.fact.etaMissing'
      | 'incidents.fact.portChange'
      | 'incidents.fact.dataInconsistent'
    readonly messageParams: Record<string, string | number>
  }
  readonly action: {
    readonly actionKey:
      | 'incidents.action.updateRedestination'
      | 'incidents.action.checkEta'
      | 'incidents.action.followUpCustoms'
      | 'incidents.action.reviewData'
    readonly actionParams: Record<string, string | number>
    readonly actionKind: OperationalIncidentActionKind
  } | null
  readonly scope: {
    readonly affectedContainerCount: number
    readonly containers: readonly {
      readonly containerId: string
      readonly containerNumber: string
      readonly lifecycleState: TrackingAlertLifecycleState
    }[]
  }
  readonly detectedAt: string
  readonly triggeredAt: string
  readonly triggerRefs: readonly {
    readonly alertId: string
    readonly containerId: string
  }[]
  readonly members: readonly OperationalIncidentMemberReadModel[]
}

export type OperationalIncidentsReadModel = {
  readonly summary: {
    readonly activeIncidentCount: number
    readonly affectedContainerCount: number
    readonly recognizedIncidentCount: number
  }
  readonly active: readonly OperationalIncidentReadModel[]
  readonly recognized: readonly OperationalIncidentReadModel[]
}

type ContainerAlertsInput = {
  readonly containerId: string
  readonly containerNumber: string
  readonly alerts: readonly TrackingAlert[]
}

type BuildOperationalIncidentsReadModelCommand = {
  readonly containers: readonly ContainerAlertsInput[]
}

type AlertMessageParamValue = string | number

type PendingOperationalIncidentMember = {
  readonly incidentKey: string
  readonly category: OperationalIncidentCategory
  readonly type: TrackingAlertType
  readonly severity: TrackingAlert['severity']
  readonly fact: OperationalIncidentReadModel['fact']
  readonly action: OperationalIncidentReadModel['action']
  readonly containerId: string
  readonly containerNumber: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAt: string
  readonly triggeredAt: string
  readonly records: readonly OperationalIncidentRecordReadModel[]
}

type TransshipmentAlert = Extract<
  TrackingAlert,
  { readonly message_key: 'alerts.transshipmentDetected' }
>
type PlannedTransshipmentAlert = Extract<
  TrackingAlert,
  { readonly message_key: 'alerts.plannedTransshipmentDetected' }
>
type CustomsHoldAlert = Extract<
  TrackingAlert,
  { readonly message_key: 'alerts.customsHoldDetected' }
>
type TransshipmentLikeAlert = TransshipmentAlert | PlannedTransshipmentAlert

function isTransshipmentAlert(alert: TrackingAlert): alert is TransshipmentAlert {
  return alert.type === 'TRANSSHIPMENT' && alert.message_key === 'alerts.transshipmentDetected'
}

function isPlannedTransshipmentAlert(alert: TrackingAlert): alert is PlannedTransshipmentAlert {
  return (
    alert.type === 'PLANNED_TRANSSHIPMENT' &&
    alert.message_key === 'alerts.plannedTransshipmentDetected'
  )
}

function isTransshipmentLikeAlert(alert: TrackingAlert): alert is TransshipmentLikeAlert {
  return isTransshipmentAlert(alert) || isPlannedTransshipmentAlert(alert)
}

function isCustomsHoldAlert(alert: TrackingAlert): alert is CustomsHoldAlert {
  return alert.type === 'CUSTOMS_HOLD' && alert.message_key === 'alerts.customsHoldDetected'
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/gu, ' ').toUpperCase()
}

function toLifecycleState(alert: TrackingAlert): TrackingAlertLifecycleState {
  return resolveAlertLifecycleState(alert)
}

function toAlertRecord(alert: TrackingAlert): OperationalIncidentRecordReadModel {
  return {
    alertId: alert.id,
    lifecycleState: toLifecycleState(alert),
    detectedAt: alert.detected_at,
    triggeredAt: alert.triggered_at,
    ackedAt: alert.acked_at,
    resolvedAt: alert.resolved_at ?? null,
    resolvedReason: alert.resolved_reason ?? null,
  }
}

function toRepresentativeRecords(
  alerts: readonly TrackingAlert[],
): readonly OperationalIncidentRecordReadModel[] {
  return [...alerts].map(toAlertRecord).sort(compareAlertRecordsByActionTimeDesc)
}

function toMessageParams(
  params: TrackingAlert['message_params'],
): Record<string, AlertMessageParamValue> {
  const mapped: Record<string, AlertMessageParamValue> = {}

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') {
      mapped[key] = value
    }
  }

  return mapped
}

function toIncidentCategory(type: TrackingAlertType): OperationalIncidentCategory {
  switch (type) {
    case 'TRANSSHIPMENT':
    case 'PLANNED_TRANSSHIPMENT':
    case 'PORT_CHANGE':
      return 'movement'
    case 'CUSTOMS_HOLD':
      return 'customs'
    case 'ETA_MISSING':
    case 'ETA_PASSED':
      return 'eta'
    case 'DATA_INCONSISTENT':
      return 'data'
  }
}

function compareSeverity(
  left: TrackingAlert['severity'],
  right: TrackingAlert['severity'],
): number {
  const rank = {
    info: 0,
    warning: 1,
    danger: 2,
  } as const

  return rank[left] - rank[right]
}

function compareAlertRecordsByActionTimeDesc(
  left: OperationalIncidentRecordReadModel,
  right: OperationalIncidentRecordReadModel,
): number {
  const leftActionAt = left.ackedAt ?? left.resolvedAt ?? left.triggeredAt
  const rightActionAt = right.ackedAt ?? right.resolvedAt ?? right.triggeredAt
  const actionCompare = rightActionAt.localeCompare(leftActionAt)
  if (actionCompare !== 0) return actionCompare
  return right.alertId.localeCompare(left.alertId)
}

function pickRepresentativeAlert<TAlert extends TrackingAlert>(alerts: readonly TAlert[]): TAlert {
  const activeAlerts = alerts.filter((alert) => toLifecycleState(alert) === 'ACTIVE')
  const pool = activeAlerts.length > 0 ? activeAlerts : alerts

  const representative = [...pool].sort((left, right) => {
    const leftActionAt = left.acked_at ?? left.resolved_at ?? left.triggered_at
    const rightActionAt = right.acked_at ?? right.resolved_at ?? right.triggered_at
    const actionCompare = rightActionAt.localeCompare(leftActionAt)
    if (actionCompare !== 0) return actionCompare
    return right.id.localeCompare(left.id)
  })[0]

  if (representative === undefined) {
    throw new Error('operational incidents: representative alert missing')
  }

  return representative
}

function toMemberLifecycleState(records: readonly OperationalIncidentRecordReadModel[]) {
  if (records.some((record) => record.lifecycleState === 'ACTIVE')) return 'ACTIVE'
  if (records.some((record) => record.lifecycleState === 'ACKED')) return 'ACKED'
  return 'AUTO_RESOLVED'
}

function toHighestSeverity(
  members: readonly PendingOperationalIncidentMember[],
): TrackingAlert['severity'] {
  const highest = [...members]
    .map((member) => member.severity)
    .sort((left, right) => compareSeverity(right, left))[0]

  if (highest === undefined) {
    throw new Error('operational incidents: severity missing')
  }

  return highest
}

function toEarliestDetectedAt(members: readonly PendingOperationalIncidentMember[]): string {
  const earliest = [...members]
    .map((member) => member.detectedAt)
    .sort((left, right) => left.localeCompare(right))[0]

  if (earliest === undefined) {
    throw new Error('operational incidents: detectedAt missing')
  }

  return earliest
}

function toLatestTriggeredAt(members: readonly PendingOperationalIncidentMember[]): string {
  const latest = [...members]
    .map((member) => member.triggeredAt)
    .sort((left, right) => right.localeCompare(left))[0]

  if (latest === undefined) {
    throw new Error('operational incidents: triggeredAt missing')
  }

  return latest
}

function toFactReadModel(alert: TrackingAlert): OperationalIncidentReadModel['fact'] {
  const messageParams = toMessageParams(alert.message_params)

  switch (alert.type) {
    case 'TRANSSHIPMENT':
      return {
        messageKey: 'incidents.fact.transshipmentDetected',
        messageParams,
      }
    case 'PLANNED_TRANSSHIPMENT':
      return {
        messageKey: 'incidents.fact.plannedTransshipmentDetected',
        messageParams,
      }
    case 'ETA_PASSED':
      return {
        messageKey: 'incidents.fact.etaPassed',
        messageParams,
      }
    case 'ETA_MISSING':
      return {
        messageKey: 'incidents.fact.etaMissing',
        messageParams,
      }
    case 'CUSTOMS_HOLD':
      return {
        messageKey: 'incidents.fact.customsHoldDetected',
        messageParams,
      }
    case 'PORT_CHANGE':
      return {
        messageKey: 'incidents.fact.portChange',
        messageParams,
      }
    case 'DATA_INCONSISTENT':
      return {
        messageKey: 'incidents.fact.dataInconsistent',
        messageParams,
      }
  }
}

function toActionReadModel(alert: TrackingAlert): OperationalIncidentReadModel['action'] {
  const actionParams = toMessageParams(alert.message_params)

  switch (alert.type) {
    case 'TRANSSHIPMENT':
    case 'PLANNED_TRANSSHIPMENT':
    case 'PORT_CHANGE':
      return {
        actionKey: 'incidents.action.updateRedestination',
        actionParams,
        actionKind: 'UPDATE_REDESTINATION',
      }
    case 'ETA_PASSED':
    case 'ETA_MISSING':
      return {
        actionKey: 'incidents.action.checkEta',
        actionParams,
        actionKind: 'CHECK_ETA',
      }
    case 'CUSTOMS_HOLD':
      return {
        actionKey: 'incidents.action.followUpCustoms',
        actionParams,
        actionKind: 'FOLLOW_UP_CUSTOMS',
      }
    case 'DATA_INCONSISTENT':
      return {
        actionKey: 'incidents.action.reviewData',
        actionParams,
        actionKind: 'REVIEW_DATA',
      }
  }
}

function serializeCustomsIncidentKey(alert: CustomsHoldAlert): string {
  return `CUSTOMS_HOLD:location=${normalizeKeyPart(alert.message_params.location)}`
}

function toGenericIncidentKey(alert: TrackingAlert): string {
  if (isCustomsHoldAlert(alert)) {
    return serializeCustomsIncidentKey(alert)
  }

  if (alert.type === 'ETA_MISSING' || alert.type === 'ETA_PASSED') {
    return alert.type
  }

  if (alert.type === 'PORT_CHANGE' || alert.type === 'DATA_INCONSISTENT') {
    return alert.type
  }

  throw new Error(`operational incidents: unsupported generic alert type ${alert.type}`)
}

function toAlertFingerprintKey(alert: TransshipmentLikeAlert): string {
  if (alert.alert_fingerprint !== null && alert.alert_fingerprint.length > 0) {
    return alert.alert_fingerprint
  }

  return [
    alert.type,
    normalizeKeyPart(alert.message_params.port),
    normalizeKeyPart(alert.message_params.fromVessel),
    normalizeKeyPart(alert.message_params.toVessel),
  ].join('|')
}

function buildTransshipmentOrderByFingerprint(
  alerts: readonly TransshipmentLikeAlert[],
): ReadonlyMap<string, number> {
  const groupedByFingerprint = new Map<string, TransshipmentLikeAlert[]>()

  for (const alert of alerts) {
    const fingerprintKey = toAlertFingerprintKey(alert)
    const group = groupedByFingerprint.get(fingerprintKey)
    if (group === undefined) {
      groupedByFingerprint.set(fingerprintKey, [alert])
      continue
    }

    group.push(alert)
  }

  const orderedGroups = [...groupedByFingerprint.entries()].sort((left, right) => {
    const leftDetectedAt = [...left[1]]
      .map((alert) => alert.detected_at)
      .sort((a, b) => a.localeCompare(b))[0]
    const rightDetectedAt = [...right[1]]
      .map((alert) => alert.detected_at)
      .sort((a, b) => a.localeCompare(b))[0]

    if (leftDetectedAt === undefined || rightDetectedAt === undefined) {
      return left[0].localeCompare(right[0])
    }

    const detectedAtCompare = leftDetectedAt.localeCompare(rightDetectedAt)
    if (detectedAtCompare !== 0) return detectedAtCompare
    return left[0].localeCompare(right[0])
  })

  return new Map(orderedGroups.map(([fingerprintKey], index) => [fingerprintKey, index + 1]))
}

function buildTransshipmentLikeMembers(
  container: ContainerAlertsInput,
): readonly PendingOperationalIncidentMember[] {
  const transshipmentAlerts = container.alerts.filter(isTransshipmentLikeAlert)
  if (transshipmentAlerts.length === 0) return []

  const orderByFingerprint = buildTransshipmentOrderByFingerprint(transshipmentAlerts)
  const groupedAlerts = new Map<string, TransshipmentLikeAlert[]>()

  for (const alert of transshipmentAlerts) {
    const fingerprintKey = toAlertFingerprintKey(alert)
    const group = groupedAlerts.get(fingerprintKey)
    if (group === undefined) {
      groupedAlerts.set(fingerprintKey, [alert])
      continue
    }

    group.push(alert)
  }

  return [...groupedAlerts.entries()].map(([fingerprintKey, alerts]) => {
    const representative = pickRepresentativeAlert(alerts)
    const records = toRepresentativeRecords(alerts)
    const lifecycleState = toMemberLifecycleState(records)
    const transshipmentOrder = orderByFingerprint.get(fingerprintKey) ?? 0

    return {
      incidentKey: [
        representative.type,
        String(transshipmentOrder),
        normalizeKeyPart(representative.message_params.port),
        normalizeKeyPart(representative.message_params.fromVessel),
        normalizeKeyPart(representative.message_params.toVessel),
      ].join(':'),
      category: toIncidentCategory(representative.type),
      type: representative.type,
      severity: representative.severity,
      fact: toFactReadModel(representative),
      action: toActionReadModel(representative),
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      lifecycleState,
      detectedAt: representative.detected_at,
      triggeredAt: representative.triggered_at,
      records,
    }
  })
}

function buildGenericMembers(
  container: ContainerAlertsInput,
): readonly PendingOperationalIncidentMember[] {
  const genericAlerts = container.alerts.filter((alert) => !isTransshipmentLikeAlert(alert))
  if (genericAlerts.length === 0) return []

  const groupedByIncidentKey = new Map<string, TrackingAlert[]>()

  for (const alert of genericAlerts) {
    const incidentKey = toGenericIncidentKey(alert)
    const group = groupedByIncidentKey.get(incidentKey)
    if (group === undefined) {
      groupedByIncidentKey.set(incidentKey, [alert])
      continue
    }

    group.push(alert)
  }

  return [...groupedByIncidentKey.entries()].map(([incidentKey, alerts]) => {
    const representative = pickRepresentativeAlert(alerts)
    const records = toRepresentativeRecords(alerts)

    return {
      incidentKey,
      category: toIncidentCategory(representative.type),
      type: representative.type,
      severity: representative.severity,
      fact: toFactReadModel(representative),
      action: toActionReadModel(representative),
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      lifecycleState: toMemberLifecycleState(records),
      detectedAt: representative.detected_at,
      triggeredAt: representative.triggered_at,
      records,
    }
  })
}

function buildPendingMembers(
  command: BuildOperationalIncidentsReadModelCommand,
): readonly PendingOperationalIncidentMember[] {
  return command.containers.flatMap((container) => [
    ...buildTransshipmentLikeMembers(container),
    ...buildGenericMembers(container),
  ])
}

function toMemberBucket(member: PendingOperationalIncidentMember): OperationalIncidentBucket {
  return member.lifecycleState === 'ACTIVE' ? 'active' : 'recognized'
}

function toIncidentBucket(
  members: readonly PendingOperationalIncidentMember[],
): OperationalIncidentBucket {
  return members.some((member) => member.lifecycleState === 'ACTIVE') ? 'active' : 'recognized'
}

function compareIncidentMembersByContainer(
  left: PendingOperationalIncidentMember,
  right: PendingOperationalIncidentMember,
): number {
  const containerCompare = left.containerNumber.localeCompare(right.containerNumber)
  if (containerCompare !== 0) return containerCompare
  return left.containerId.localeCompare(right.containerId)
}

function toRepresentativeMember(
  members: readonly PendingOperationalIncidentMember[],
): PendingOperationalIncidentMember {
  const activeMembers = members.filter((member) => member.lifecycleState === 'ACTIVE')
  const pool = activeMembers.length > 0 ? activeMembers : members
  const representative = [...pool].sort((left, right) => {
    const triggeredAtCompare = right.triggeredAt.localeCompare(left.triggeredAt)
    if (triggeredAtCompare !== 0) return triggeredAtCompare
    return right.containerNumber.localeCompare(left.containerNumber)
  })[0]

  if (representative === undefined) {
    throw new Error('operational incidents: representative member missing')
  }

  return representative
}

function compareIncidents(
  left: OperationalIncidentReadModel,
  right: OperationalIncidentReadModel,
): number {
  const severityCompare = compareSeverity(right.severity, left.severity)
  if (severityCompare !== 0) return severityCompare
  const triggeredAtCompare = right.triggeredAt.localeCompare(left.triggeredAt)
  if (triggeredAtCompare !== 0) return triggeredAtCompare
  return left.incidentKey.localeCompare(right.incidentKey)
}

export function buildOperationalIncidentsReadModel(
  command: BuildOperationalIncidentsReadModelCommand,
): OperationalIncidentsReadModel {
  const pendingMembers = buildPendingMembers(command)
  const groupedByIncidentKey = new Map<string, PendingOperationalIncidentMember[]>()

  for (const member of pendingMembers) {
    const incidentGroupKey = `${member.incidentKey}::${toMemberBucket(member)}`
    const group = groupedByIncidentKey.get(incidentGroupKey)
    if (group === undefined) {
      groupedByIncidentKey.set(incidentGroupKey, [member])
      continue
    }

    group.push(member)
  }

  const incidents = [...groupedByIncidentKey.values()].map((members) => {
    const sortedMembers = [...members].sort(compareIncidentMembersByContainer)
    const representativeMember = toRepresentativeMember(sortedMembers)
    const bucket = toIncidentBucket(sortedMembers)

    return {
      incidentKey: representativeMember.incidentKey,
      bucket,
      category: representativeMember.category,
      type: representativeMember.type,
      severity: toHighestSeverity(sortedMembers),
      fact: representativeMember.fact,
      action: representativeMember.action,
      scope: {
        affectedContainerCount: sortedMembers.length,
        containers: sortedMembers.map((member) => ({
          containerId: member.containerId,
          containerNumber: member.containerNumber,
          lifecycleState: member.lifecycleState,
        })),
      },
      detectedAt: toEarliestDetectedAt(sortedMembers),
      triggeredAt: toLatestTriggeredAt(sortedMembers),
      triggerRefs: [...new Map(
        sortedMembers
          .flatMap((member) =>
            member.records.map((record) => [
              `${record.alertId}:${member.containerId}`,
              {
                alertId: record.alertId,
                containerId: member.containerId,
              },
            ] as const),
          ),
      ).values()],
      members: sortedMembers.map((member) => ({
        containerId: member.containerId,
        containerNumber: member.containerNumber,
        lifecycleState: member.lifecycleState,
        detectedAt: member.detectedAt,
        records: [...member.records].sort(compareAlertRecordsByActionTimeDesc),
      })),
    } satisfies OperationalIncidentReadModel
  })

  const active = incidents.filter((incident) => incident.bucket === 'active').sort(compareIncidents)
  const recognized = incidents
    .filter((incident) => incident.bucket === 'recognized')
    .sort(compareIncidents)

  const affectedContainerIds = new Set<string>()
  for (const incident of active) {
    for (const member of incident.members) {
      affectedContainerIds.add(member.containerId)
    }
  }

  return {
    summary: {
      activeIncidentCount: active.length,
      affectedContainerCount: affectedContainerIds.size,
      recognizedIncidentCount: recognized.length,
    },
    active,
    recognized,
  }
}

export const buildShipmentAlertIncidentsReadModel = buildOperationalIncidentsReadModel

export type ShipmentAlertIncidentCategory = OperationalIncidentCategory
export type ShipmentAlertIncidentBucket = OperationalIncidentBucket
export type ShipmentAlertIncidentRecordReadModel = OperationalIncidentRecordReadModel
export type ShipmentAlertIncidentMemberReadModel = OperationalIncidentMemberReadModel
export type ShipmentAlertIncidentReadModel = OperationalIncidentReadModel
export type ShipmentAlertIncidentsReadModel = OperationalIncidentsReadModel
