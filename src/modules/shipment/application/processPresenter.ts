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
  readonly status: string
  readonly statusLabel: string
  readonly eta: string | null
  readonly timeline: readonly TimelineEvent[]
  readonly isoType?: string | null
}

export type ShipmentDetail = {
  readonly id: string
  readonly processRef: string
  readonly reference?: string | null
  readonly operationType?: string
  readonly carrier?: string | null
  readonly bl_reference?: string | null
  readonly origin: string
  readonly destination: string
  readonly status: string
  readonly statusLabel: string
  readonly eta: string | null
  readonly containers: readonly ContainerDetail[]
  readonly alerts: readonly AlertDisplay[]
}

// Input shape from /api/processes/:id
export type ProcessApiResponse = {
  id: string
  reference: string | null
  operation_type: string
  origin: { display_name?: string | null } | null
  destination: { display_name?: string | null } | null
  carrier: string | null
  bl_reference: string | null
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    iso_type: string | null
    initial_status: string
    eta?: string | null
    events?: Array<{
      id?: string
      activity?: string
      event_time?: string | null
      event_time_type?: string | null
      location?: string | null
      raw?: Record<string, unknown>
    }>
  }>
  alerts: Array<{
    id: string
    category: string
    code: string
    severity: string
    title: string
    description: string | null
    state: string
    created_at: string
  }>
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

export function presentProcess(data: ProcessApiResponse): ShipmentDetail {
  const createdAt = new Date(data.created_at)
  const createdEvent: TimelineEvent = {
    id: 'system-created',
    label: 'Process registered in the system',
    location: undefined,
    date: createdAt.toLocaleDateString(),
    status: 'completed',
  }

  return {
    id: data.id,
    processRef: data.reference || `<${data.id.slice(0, 8)}>`,
    reference: data.reference,
    operationType: data.operation_type,
    carrier: data.carrier,
    bl_reference: data.bl_reference,
    origin: data.origin?.display_name || '—',
    destination: data.destination?.display_name || '—',
    status: 'unknown',
    statusLabel: 'Aguardando dados',
    eta: null,
    containers: data.containers.map((c) => {
      let timeline: TimelineEvent[] = [createdEvent]
      if (Array.isArray(c.events) && c.events.length > 0) {
        const mapped = c.events
          .map((ev, idx) => {
            const evDate = ev.event_time ? new Date(ev.event_time) : null
            const dateStr = evDate ? evDate.toLocaleDateString() : null
            const expectedDate =
              ev.event_time_type === 'EXPECTED' && ev.event_time
                ? new Date(ev.event_time).toLocaleDateString()
                : null
            const status: EventStatus = ev.event_time_type === 'ACTUAL' ? 'completed' : 'expected'
            return {
              id: ev.id ?? `ev-${idx}`,
              label:
                ev.activity ??
                ((ev.raw as Record<string, unknown>)['Description'] as string) ??
                'Event',
              location:
                ev.location ??
                ((ev.raw as Record<string, unknown>)['Location'] as string) ??
                undefined,
              date: dateStr,
              expectedDate,
              status,
            } as TimelineEvent
          })
          .filter(Boolean)

        if (mapped.length > 0) timeline = mapped
      }

      return {
        id: c.id,
        number: c.container_number,
        isoType: c.iso_type ?? null,
        status: 'unknown',
        statusLabel: c.initial_status === 'booked' ? 'Booked' : 'Unknown',
        eta: c.eta ?? null,
        timeline,
      }
    }),
    alerts: data.alerts
      .filter((a) => a.state === 'active')
      .map((a) => ({
        id: a.id,
        type: mapAlertType(a.code),
        severity: a.severity as AlertDisplay['severity'],
        message: a.description || a.title,
        timestamp: formatRelativeTime(a.created_at),
      })),
  }
}
