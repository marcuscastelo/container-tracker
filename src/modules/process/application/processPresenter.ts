import { z } from 'zod'
import type { AlertSeverity } from '~/modules/alert'
import {
  type Carrier,
  CarrierSchema,
  type OperationType,
  OperationTypeSchema,
} from '~/modules/process/domain/value-objects'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import type { StatusVariant } from '~/shared/ui'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'

// Backwards-compatible alias for tests and other callers
export type ProcessApiResponse = ProcessDetailResponse

// Presenter: convert ProcessApiResponse (API) into ShipmentDetail (UI shape)
export type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

export type TimelineEvent = {
  readonly id: string
  readonly label: string
  readonly location?: string
  readonly date: string | null
  readonly expectedDate?: string | null
  readonly status: EventStatus
}

export type AlertDisplay = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'info'
  readonly severity: 'info' | 'success' | 'warning' | 'danger'
  readonly message: string
  readonly timestamp: string
}

export type ContainerDetail = {
  readonly id: string
  readonly number: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly timeline: readonly TimelineEvent[]
  readonly isoType?: string | null
}

export type ShipmentDetail = {
  readonly id: string
  readonly processRef: string
  readonly reference?: string | null
  readonly operationType?: OperationType
  readonly carrier?: Carrier | null
  // TODO: ShipmentDetail is duplicated throughout the codebase, unify in api schemas with zod and proper typesbill_of_lading
  // TODO: Once unified, change all references from bl_reference to bill_of_lading or billOfLading
  readonly bl_reference?: string | null
  readonly origin: string
  readonly destination: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly containers: readonly ContainerDetail[]
  readonly alerts: readonly AlertDisplay[]
}

function mapAlertType(code: string): AlertDisplay['type'] {
  if (code.startsWith('ETA_')) return 'missing-eta'
  if (code.includes('DELAY') || code.includes('PASSED')) return 'delay'
  if (code.includes('CUSTOMS')) return 'customs'
  return 'info'
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function presentProcess(data: ProcessDetailResponse): ShipmentDetail {
  const createdAt = new Date(data.created_at)
  const createdEvent: TimelineEvent = {
    id: 'system-created',
    label: 'Process registered in the system',
    location: undefined,
    date: createdAt.toLocaleDateString(),
    status: 'completed',
  }

  const operationTypeResult = OperationTypeSchema.safeParse(data.operation_type)
  const operationType: OperationType | undefined = operationTypeResult.success
    ? operationTypeResult.data
    : undefined

  const carrierResult = CarrierSchema.safeParse(data.carrier)
  const carrier: Carrier | 'unknown' | null =
    data.carrier === null ? null : carrierResult.success ? carrierResult.data : 'unknown'

  return {
    id: data.id,
    processRef: data.reference || `<${data.id.slice(0, 8)}>`,
    reference: data.reference,
    operationType,
    carrier,
    bl_reference: data.bl_reference,
    origin: data.origin?.display_name || '—',
    destination: data.destination?.display_name || '—',
    status: 'unknown',
    statusLabel: 'Aguardando dados',
    eta: null,
    containers: data.containers.map((c) => {
      let timeline: TimelineEvent[] = [createdEvent]
      if (Array.isArray(c.events) && c.events.length > 0) {
        const mapped = (c.events ?? [])
          .map((ev, idx) => {
            const evDate = ev.event_time ? new Date(ev.event_time) : null
            const dateStr = evDate ? evDate.toLocaleDateString() : null
            const expectedDate =
              ev.event_time_type === 'EXPECTED' && ev.event_time
                ? new Date(ev.event_time).toLocaleDateString()
                : null
            const status: EventStatus = ev.event_time_type === 'ACTUAL' ? 'completed' : 'expected'

            const raw = ev.raw
            // Safely pick description/activity from raw carrier payloads
            const rawObj = safeParseOrDefault(raw, z.record(z.string(), z.unknown()), null)
            const rawDescription = rawObj
              ? typeof rawObj['Description'] === 'string'
                ? rawObj['Description']
                : typeof rawObj['description'] === 'string'
                  ? rawObj['description']
                  : typeof rawObj['Activity'] === 'string'
                    ? rawObj['Activity']
                    : typeof rawObj['activity'] === 'string'
                      ? rawObj['activity']
                      : undefined
              : undefined

            const rawLocation = rawObj
              ? typeof rawObj['Location'] === 'string'
                ? rawObj['Location']
                : typeof rawObj['location'] === 'string'
                  ? rawObj['location']
                  : undefined
              : undefined

            return {
              id: ev.id ?? `ev-${idx}`,
              label: ev.activity ?? rawDescription ?? 'Event',
              location: ev.location ?? rawLocation ?? undefined,
              date: dateStr,
              expectedDate,
              status,
            } satisfies TimelineEvent
          })
          .filter(Boolean)

        if (mapped.length > 0) timeline = mapped
      }

      return {
        id: c.id,
        number: c.container_number,
        isoType: c.container_type ?? null,
        status: 'unknown',
        statusLabel: 'Unknown',
        eta: c.eta ?? null,
        timeline,
      }
    }),
    alerts: (data.alerts ?? [])
      .filter((a) => a.state === 'active')
      .map((a) => {
        const sev = ((): AlertSeverity => {
          const s = a.severity
          if (s === 'info' || s === 'success' || s === 'warning' || s === 'danger') return s
          return 'info'
        })()
        return {
          id: a.id,
          type: mapAlertType(a.code),
          severity: sev,
          message: a.description || a.title,
          timestamp: formatRelativeTime(a.created_at),
        }
      }),
  }
}
