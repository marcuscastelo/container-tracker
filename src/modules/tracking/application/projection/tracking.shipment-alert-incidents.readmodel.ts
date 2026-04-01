import {
  resolveAlertLifecycleState,
  type TrackingAlert,
  type TrackingAlertLifecycleState,
  type TrackingAlertMessageKey,
  type TrackingAlertResolvedReason,
  type TrackingAlertType,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

export type ShipmentAlertIncidentCategory = 'movement' | 'eta' | 'customs' | 'status' | 'data'
export type ShipmentAlertIncidentBucket = 'active' | 'recognized'

export type ShipmentAlertIncidentRecordReadModel = {
  readonly alertId: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAt: string
  readonly triggeredAt: string
  readonly ackedAt: string | null
  readonly resolvedAt: string | null
  readonly resolvedReason: TrackingAlertResolvedReason | null
  readonly thresholdDays: number | null
  readonly daysWithoutMovement: number | null
  readonly lastEventDate: string | null
}

export type ShipmentAlertIncidentMemberReadModel = {
  readonly containerId: string
  readonly containerNumber: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAt: string
  readonly records: readonly ShipmentAlertIncidentRecordReadModel[]
  readonly thresholdDays: number | null
  readonly daysWithoutMovement: number | null
  readonly lastEventDate: string | null
  readonly transshipmentOrder: number | null
  readonly port: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
}

export type ShipmentAlertIncidentReadModel = {
  readonly incidentKey: string
  readonly bucket: ShipmentAlertIncidentBucket
  readonly category: ShipmentAlertIncidentCategory
  readonly type: TrackingAlertType
  readonly severity: TrackingAlert['severity']
  readonly messageKey: TrackingAlertMessageKey
  readonly messageParams: Record<string, string | number>
  readonly detectedAt: string
  readonly triggeredAt: string
  readonly thresholdDays: number | null
  readonly daysWithoutMovement: number | null
  readonly lastEventDate: string | null
  readonly transshipmentOrder: number | null
  readonly port: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
  readonly affectedContainerCount: number
  readonly activeAlertIds: readonly string[]
  readonly ackedAlertIds: readonly string[]
  readonly members: readonly ShipmentAlertIncidentMemberReadModel[]
  readonly monitoringHistory: readonly ShipmentAlertIncidentRecordReadModel[]
}

export type ShipmentAlertIncidentsReadModel = {
  readonly summary: {
    readonly activeIncidentCount: number
    readonly affectedContainerCount: number
    readonly recognizedIncidentCount: number
  }
  readonly active: readonly ShipmentAlertIncidentReadModel[]
  readonly recognized: readonly ShipmentAlertIncidentReadModel[]
}

type ContainerAlertsInput = {
  readonly containerId: string
  readonly containerNumber: string
  readonly alerts: readonly TrackingAlert[]
}

type BuildShipmentAlertIncidentsReadModelCommand = {
  readonly containers: readonly ContainerAlertsInput[]
}

type PendingShipmentAlertIncidentMember = {
  readonly incidentKey: string
  readonly category: ShipmentAlertIncidentCategory
  readonly type: TrackingAlertType
  readonly severity: TrackingAlert['severity']
  readonly messageKey: TrackingAlertMessageKey
  readonly messageParams: Record<string, string | number>
  readonly containerId: string
  readonly containerNumber: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAt: string
  readonly records: readonly ShipmentAlertIncidentRecordReadModel[]
  readonly thresholdDays: number | null
  readonly daysWithoutMovement: number | null
  readonly lastEventDate: string | null
  readonly transshipmentOrder: number | null
  readonly port: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
  readonly triggeredAt: string
  readonly activeAlertIds: readonly string[]
  readonly ackedAlertIds: readonly string[]
}

type AlertMessageParamValue = string | number

type TransshipmentAlert = Extract<
  TrackingAlert,
  { readonly message_key: 'alerts.transshipmentDetected' }
>
type NoMovementAlert = Extract<TrackingAlert, { readonly message_key: 'alerts.noMovementDetected' }>
type CustomsHoldAlert = Extract<
  TrackingAlert,
  { readonly message_key: 'alerts.customsHoldDetected' }
>

function isTransshipmentAlert(alert: TrackingAlert): alert is TransshipmentAlert {
  return alert.type === 'TRANSSHIPMENT' && alert.message_key === 'alerts.transshipmentDetected'
}

function isNoMovementAlert(alert: TrackingAlert): alert is NoMovementAlert {
  return alert.type === 'NO_MOVEMENT' && alert.message_key === 'alerts.noMovementDetected'
}

function isCustomsHoldAlert(alert: TrackingAlert): alert is CustomsHoldAlert {
  return alert.type === 'CUSTOMS_HOLD' && alert.message_key === 'alerts.customsHoldDetected'
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

function toLifecycleState(alert: TrackingAlert): TrackingAlertLifecycleState {
  return resolveAlertLifecycleState(alert)
}

function toAlertRecord(alert: TrackingAlert): ShipmentAlertIncidentRecordReadModel {
  const lifecycleState = toLifecycleState(alert)
  const thresholdDays = isNoMovementAlert(alert) ? alert.message_params.threshold_days : null
  const daysWithoutMovement = isNoMovementAlert(alert)
    ? alert.message_params.days_without_movement
    : null
  const lastEventDate = isNoMovementAlert(alert) ? alert.message_params.lastEventDate : null

  return {
    alertId: alert.id,
    lifecycleState,
    detectedAt: alert.detected_at,
    triggeredAt: alert.triggered_at,
    ackedAt: alert.acked_at,
    resolvedAt: alert.resolved_at ?? null,
    resolvedReason: alert.resolved_reason ?? null,
    thresholdDays,
    daysWithoutMovement,
    lastEventDate,
  }
}

function toRepresentativeRecords<TAlert extends TrackingAlert>(
  alerts: readonly TAlert[],
): readonly ShipmentAlertIncidentRecordReadModel[] {
  return [...alerts].map(toAlertRecord).sort((left, right) => {
    const thresholdCompare = (left.thresholdDays ?? -1) - (right.thresholdDays ?? -1)
    if (thresholdCompare !== 0) return thresholdCompare
    const triggeredAtCompare = left.triggeredAt.localeCompare(right.triggeredAt)
    if (triggeredAtCompare !== 0) return triggeredAtCompare
    return left.alertId.localeCompare(right.alertId)
  })
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

function toIncidentCategory(type: TrackingAlertType): ShipmentAlertIncidentCategory {
  switch (type) {
    case 'TRANSSHIPMENT':
      return 'movement'
    case 'CUSTOMS_HOLD':
      return 'customs'
    case 'NO_MOVEMENT':
      return 'status'
    case 'ETA_MISSING':
    case 'ETA_PASSED':
      return 'eta'
    case 'PORT_CHANGE':
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
  left: ShipmentAlertIncidentRecordReadModel,
  right: ShipmentAlertIncidentRecordReadModel,
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
    throw new Error('shipment alert incidents: representative alert missing')
  }

  return representative
}

function toMemberLifecycleState(records: readonly ShipmentAlertIncidentRecordReadModel[]) {
  if (records.some((record) => record.lifecycleState === 'ACTIVE')) return 'ACTIVE'
  if (records.some((record) => record.lifecycleState === 'ACKED')) return 'ACKED'
  return 'AUTO_RESOLVED'
}

function toHighestSeverity(
  members: readonly PendingShipmentAlertIncidentMember[],
): TrackingAlert['severity'] {
  const highest = [...members]
    .map((member) => member.severity)
    .sort((left, right) => compareSeverity(right, left))[0]

  if (highest === undefined) {
    throw new Error('shipment alert incidents: severity missing')
  }

  return highest
}

function toEarliestDetectedAt(members: readonly PendingShipmentAlertIncidentMember[]): string {
  const earliest = [...members]
    .map((member) => member.detectedAt)
    .sort((left, right) => left.localeCompare(right))[0]

  if (earliest === undefined) {
    throw new Error('shipment alert incidents: detectedAt missing')
  }

  return earliest
}

function toLatestTriggeredAt(members: readonly PendingShipmentAlertIncidentMember[]): string {
  const latest = [...members]
    .map((member) => member.triggeredAt)
    .sort((left, right) => right.localeCompare(left))[0]

  if (latest === undefined) {
    throw new Error('shipment alert incidents: triggeredAt missing')
  }

  return latest
}

function toLatestLastEventDate(
  members: readonly PendingShipmentAlertIncidentMember[],
): string | null {
  const latest = [...members]
    .map((member) => member.lastEventDate)
    .filter((value): value is string => value !== null)
    .sort((left, right) => right.localeCompare(left))[0]

  return latest ?? null
}

function toMonitoringHistory(
  members: readonly PendingShipmentAlertIncidentMember[],
): readonly ShipmentAlertIncidentRecordReadModel[] {
  return [...members]
    .flatMap((member) => member.records)
    .sort((left, right) => {
      const thresholdCompare = (left.thresholdDays ?? -1) - (right.thresholdDays ?? -1)
      if (thresholdCompare !== 0) return thresholdCompare
      const lastEventCompare = (left.lastEventDate ?? '').localeCompare(right.lastEventDate ?? '')
      if (lastEventCompare !== 0) return lastEventCompare
      return compareAlertRecordsByActionTimeDesc(left, right)
    })
}

function serializeMessageParams(
  messageKey: TrackingAlertMessageKey,
  messageParams: Record<string, AlertMessageParamValue>,
): string {
  if (messageKey === 'alerts.customsHoldDetected') {
    return `location=${normalizeKeyPart(String(messageParams.location ?? ''))}`
  }

  return ''
}

function toGenericIncidentKey(alert: TrackingAlert): string {
  const params = toMessageParams(alert.message_params)

  if (isCustomsHoldAlert(alert)) {
    return `${alert.type}:${serializeMessageParams(alert.message_key, params)}`
  }

  if (alert.type === 'ETA_MISSING' || alert.type === 'ETA_PASSED') {
    return alert.type
  }

  if (alert.type === 'PORT_CHANGE' || alert.type === 'DATA_INCONSISTENT') {
    return alert.type
  }

  throw new Error(`shipment alert incidents: unsupported generic alert type ${alert.type}`)
}

function toAlertFingerprintKey(alert: TrackingAlert): string {
  if (alert.alert_fingerprint !== null && alert.alert_fingerprint.length > 0) {
    return alert.alert_fingerprint
  }

  if (isTransshipmentAlert(alert)) {
    return [
      normalizeKeyPart(alert.message_params.port),
      normalizeKeyPart(alert.message_params.fromVessel),
      normalizeKeyPart(alert.message_params.toVessel),
    ].join('|')
  }

  return alert.id
}

function buildTransshipmentOrderByFingerprint(
  alerts: readonly TransshipmentAlert[],
): ReadonlyMap<string, number> {
  const groupedByFingerprint = new Map<string, TransshipmentAlert[]>()

  for (const alert of alerts) {
    if (alert.type !== 'TRANSSHIPMENT') continue

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

function buildTransshipmentMembers(
  container: ContainerAlertsInput,
): readonly PendingShipmentAlertIncidentMember[] {
  const transshipmentAlerts = container.alerts.filter(isTransshipmentAlert)
  if (transshipmentAlerts.length === 0) return []

  const orderByFingerprint = buildTransshipmentOrderByFingerprint(transshipmentAlerts)
  const groupedAlerts = new Map<string, TransshipmentAlert[]>()

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
    const transshipmentOrder = orderByFingerprint.get(fingerprintKey) ?? null
    const port = representative.message_params.port
    const fromVessel = representative.message_params.fromVessel
    const toVessel = representative.message_params.toVessel

    return {
      incidentKey: [
        'TRANSSHIPMENT',
        String(transshipmentOrder ?? 0),
        normalizeKeyPart(port),
        normalizeKeyPart(fromVessel),
        normalizeKeyPart(toVessel),
      ].join(':'),
      category: 'movement',
      type: 'TRANSSHIPMENT',
      severity: representative.severity,
      messageKey: representative.message_key,
      messageParams: toMessageParams(representative.message_params),
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      lifecycleState,
      detectedAt: representative.detected_at,
      records,
      thresholdDays: null,
      daysWithoutMovement: null,
      lastEventDate: null,
      transshipmentOrder,
      port,
      fromVessel,
      toVessel,
      triggeredAt: representative.triggered_at,
      activeAlertIds: records
        .filter((record) => record.lifecycleState === 'ACTIVE')
        .map((record) => record.alertId),
      ackedAlertIds: records
        .filter((record) => record.lifecycleState === 'ACKED')
        .map((record) => record.alertId),
    }
  })
}

function toNoMovementCycleKey(alert: NoMovementAlert): string {
  const fingerprint = alert.source_observation_fingerprints[0]
  if (typeof fingerprint === 'string' && fingerprint.length > 0) {
    return `fp:${fingerprint}`
  }

  return `date:${alert.message_params.lastEventDate}`
}

function buildNoMovementMembers(
  container: ContainerAlertsInput,
): readonly PendingShipmentAlertIncidentMember[] {
  const noMovementAlerts = container.alerts.filter(isNoMovementAlert)
  if (noMovementAlerts.length === 0) return []

  const groupedByCycle = new Map<string, NoMovementAlert[]>()
  for (const alert of noMovementAlerts) {
    const cycleKey = toNoMovementCycleKey(alert)
    const group = groupedByCycle.get(cycleKey)
    if (group === undefined) {
      groupedByCycle.set(cycleKey, [alert])
      continue
    }

    group.push(alert)
  }

  return [...groupedByCycle.entries()].map(([cycleKey, alerts]) => {
    const activeAlerts = alerts.filter((alert) => toLifecycleState(alert) === 'ACTIVE')
    const candidateAlerts = activeAlerts.length > 0 ? activeAlerts : alerts
    const representative = [...candidateAlerts].sort((left, right) => {
      const thresholdCompare =
        right.message_params.threshold_days - left.message_params.threshold_days
      if (thresholdCompare !== 0) return thresholdCompare
      const actionCompare = (
        right.acked_at ??
        right.resolved_at ??
        right.triggered_at
      ).localeCompare(left.acked_at ?? left.resolved_at ?? left.triggered_at)
      if (actionCompare !== 0) return actionCompare
      return right.id.localeCompare(left.id)
    })[0]

    if (representative === undefined) {
      throw new Error('shipment alert incidents: NO_MOVEMENT representative missing')
    }

    const records = toRepresentativeRecords(alerts)
    const lifecycleState = toMemberLifecycleState(records)

    return {
      incidentKey: `NO_MOVEMENT:${representative.message_params.threshold_days}:${cycleKey}`,
      category: 'status',
      type: 'NO_MOVEMENT',
      severity: representative.severity,
      messageKey: representative.message_key,
      messageParams: toMessageParams(representative.message_params),
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      lifecycleState,
      detectedAt: representative.detected_at,
      records,
      thresholdDays: representative.message_params.threshold_days,
      daysWithoutMovement: representative.message_params.days_without_movement,
      lastEventDate: representative.message_params.lastEventDate,
      transshipmentOrder: null,
      port: null,
      fromVessel: null,
      toVessel: null,
      triggeredAt: representative.triggered_at,
      activeAlertIds: records
        .filter((record) => record.lifecycleState === 'ACTIVE')
        .map((record) => record.alertId),
      ackedAlertIds: records
        .filter((record) => record.lifecycleState === 'ACKED')
        .map((record) => record.alertId),
    }
  })
}

function buildGenericMembers(
  container: ContainerAlertsInput,
): readonly PendingShipmentAlertIncidentMember[] {
  const genericAlerts = container.alerts.filter(
    (alert) => alert.type !== 'TRANSSHIPMENT' && alert.type !== 'NO_MOVEMENT',
  )
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
      messageKey: representative.message_key,
      messageParams: toMessageParams(representative.message_params),
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      lifecycleState: toMemberLifecycleState(records),
      detectedAt: representative.detected_at,
      records,
      thresholdDays: null,
      daysWithoutMovement: null,
      lastEventDate: null,
      transshipmentOrder: null,
      port: null,
      fromVessel: null,
      toVessel: null,
      triggeredAt: representative.triggered_at,
      activeAlertIds: records
        .filter((record) => record.lifecycleState === 'ACTIVE')
        .map((record) => record.alertId),
      ackedAlertIds: records
        .filter((record) => record.lifecycleState === 'ACKED')
        .map((record) => record.alertId),
    }
  })
}

function buildPendingMembers(
  command: BuildShipmentAlertIncidentsReadModelCommand,
): readonly PendingShipmentAlertIncidentMember[] {
  return command.containers.flatMap((container) => [
    ...buildTransshipmentMembers(container),
    ...buildNoMovementMembers(container),
    ...buildGenericMembers(container),
  ])
}

function toMemberBucket(member: PendingShipmentAlertIncidentMember): ShipmentAlertIncidentBucket {
  return member.lifecycleState === 'ACTIVE' ? 'active' : 'recognized'
}

function toIncidentBucket(
  members: readonly PendingShipmentAlertIncidentMember[],
): ShipmentAlertIncidentBucket {
  return members.some((member) => member.lifecycleState === 'ACTIVE') ? 'active' : 'recognized'
}

function compareIncidentMembersByContainer(
  left: PendingShipmentAlertIncidentMember,
  right: PendingShipmentAlertIncidentMember,
): number {
  const containerCompare = left.containerNumber.localeCompare(right.containerNumber)
  if (containerCompare !== 0) return containerCompare
  return left.containerId.localeCompare(right.containerId)
}

function toRepresentativeMember(
  members: readonly PendingShipmentAlertIncidentMember[],
): PendingShipmentAlertIncidentMember {
  const activeMembers = members.filter((member) => member.lifecycleState === 'ACTIVE')
  const pool = activeMembers.length > 0 ? activeMembers : members
  const representative = [...pool].sort((left, right) => {
    const triggeredAtCompare = right.triggeredAt.localeCompare(left.triggeredAt)
    if (triggeredAtCompare !== 0) return triggeredAtCompare
    return right.containerNumber.localeCompare(left.containerNumber)
  })[0]

  if (representative === undefined) {
    throw new Error('shipment alert incidents: representative member missing')
  }

  return representative
}

function compareIncidents(
  left: ShipmentAlertIncidentReadModel,
  right: ShipmentAlertIncidentReadModel,
): number {
  const severityCompare = compareSeverity(right.severity, left.severity)
  if (severityCompare !== 0) return severityCompare
  const triggeredAtCompare = right.triggeredAt.localeCompare(left.triggeredAt)
  if (triggeredAtCompare !== 0) return triggeredAtCompare
  return left.incidentKey.localeCompare(right.incidentKey)
}

export function buildShipmentAlertIncidentsReadModel(
  command: BuildShipmentAlertIncidentsReadModelCommand,
): ShipmentAlertIncidentsReadModel {
  const pendingMembers = buildPendingMembers(command)
  const groupedByIncidentKey = new Map<string, PendingShipmentAlertIncidentMember[]>()

  for (const member of pendingMembers) {
    const incidentGroupKey = `${member.incidentKey}::${toMemberBucket(member)}`
    const group = groupedByIncidentKey.get(incidentGroupKey)
    if (group === undefined) {
      groupedByIncidentKey.set(incidentGroupKey, [member])
      continue
    }

    group.push(member)
  }

  const incidents = [...groupedByIncidentKey.entries()].map(([_groupedIncidentKey, members]) => {
    const sortedMembers = [...members].sort(compareIncidentMembersByContainer)
    const representativeMember = toRepresentativeMember(sortedMembers)
    const bucket = toIncidentBucket(sortedMembers)

    return {
      incidentKey: representativeMember.incidentKey,
      bucket,
      category: representativeMember.category,
      type: representativeMember.type,
      severity: toHighestSeverity(sortedMembers),
      messageKey: representativeMember.messageKey,
      messageParams: representativeMember.messageParams,
      detectedAt: toEarliestDetectedAt(sortedMembers),
      triggeredAt: toLatestTriggeredAt(sortedMembers),
      thresholdDays: representativeMember.thresholdDays,
      daysWithoutMovement: representativeMember.daysWithoutMovement,
      lastEventDate: toLatestLastEventDate(sortedMembers),
      transshipmentOrder: representativeMember.transshipmentOrder,
      port: representativeMember.port,
      fromVessel: representativeMember.fromVessel,
      toVessel: representativeMember.toVessel,
      affectedContainerCount: sortedMembers.length,
      activeAlertIds: [...new Set(sortedMembers.flatMap((member) => member.activeAlertIds))],
      ackedAlertIds: [...new Set(sortedMembers.flatMap((member) => member.ackedAlertIds))],
      members: sortedMembers.map((member) => ({
        containerId: member.containerId,
        containerNumber: member.containerNumber,
        lifecycleState: member.lifecycleState,
        detectedAt: member.detectedAt,
        records: [...member.records].sort(compareAlertRecordsByActionTimeDesc),
        thresholdDays: member.thresholdDays,
        daysWithoutMovement: member.daysWithoutMovement,
        lastEventDate: member.lastEventDate,
        transshipmentOrder: member.transshipmentOrder,
        port: member.port,
        fromVessel: member.fromVessel,
        toVessel: member.toVessel,
      })),
      monitoringHistory:
        representativeMember.type === 'NO_MOVEMENT' ? toMonitoringHistory(sortedMembers) : [],
    } satisfies ShipmentAlertIncidentReadModel
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
