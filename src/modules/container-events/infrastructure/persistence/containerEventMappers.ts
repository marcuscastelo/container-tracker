import type { ContainerEvent } from '~/modules/container-events/domain/ContainerEvent'
import { EventActualitySchema } from '~/modules/container-events/domain/EventAcuality'
import { EventSourceSchema } from '~/modules/container-events/domain/EventSource'
import { EventTypeSchema } from '~/modules/container-events/domain/EventType'
import type { Database } from '~/shared/supabase/database.types'

type ContainerEventRow = Database['public']['Tables']['container-events']['Row']
type ContainerEventInsert = Database['public']['Tables']['container-events']['Insert']

// TODO: Move to type utils
export function safeParseOrDefault<T>(
  value: unknown,
  parser: (v: unknown) => T,
  defaultValue: T,
): T {
  try {
    return parser(value)
  } catch (e) {
    console.warn('Failed to parse value, using default:', { value, error: e })
    return defaultValue
  }
}

export const containerEventMappers = {
  toRow: (event: ContainerEvent): ContainerEventInsert => ({
    id: event.id,
    container_number: event.container_number,
    event_time: event.event_time,
    type: event.type,
    source: event.source,
    actuality: event.actuality,
  }),

  fromRow: (row: ContainerEventRow): ContainerEvent => ({
    id: row.id,
    container_number: row.container_number,
    event_time: row.event_time,
    type: safeParseOrDefault(row.type, EventTypeSchema.parse, 'INVALID'),
    source: safeParseOrDefault(row.source, EventSourceSchema.parse, {
      type: 'error',
      details: `Row could not be parsed into valid EventSource: ${JSON.stringify(row)}`,
    }),
    actuality: safeParseOrDefault(row.actuality, EventActualitySchema.parse, 'UNKNOWN'),
  }),

  fromRows: (rows: ContainerEventRow[]): ContainerEvent[] =>
    rows.map(containerEventMappers.fromRow),

  toInsert: (event: ContainerEvent): ContainerEventInsert => ({
    id: event.id,
    container_number: event.container_number,
    event_time: event.event_time,
    type: event.type,
    source: event.source,
    actuality: event.actuality,
  }),
}
