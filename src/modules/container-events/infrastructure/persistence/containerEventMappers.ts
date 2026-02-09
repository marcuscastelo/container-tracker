import type { ContainerEvent } from '~/modules/container-events/domain/ContainerEvent'
import { EventActualitySchema } from '~/modules/container-events/domain/EventAcuality'
import { EventSourceSchema } from '~/modules/container-events/domain/EventSource'
import { EventTypeSchema } from '~/modules/container-events/domain/EventType'
import type { Database } from '~/shared/supabase/database.types'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'

type ContainerEventRow = Database['public']['Tables']['container-events']['Row']
type ContainerEventInsert = Database['public']['Tables']['container-events']['Insert']

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
    type: safeParseOrDefault(row.type, EventTypeSchema, 'INVALID'),
    source: safeParseOrDefault(row.source, EventSourceSchema, {
      type: 'error',
      details: `Row could not be parsed into valid EventSource: ${JSON.stringify(row)}`,
    }),
    actuality: safeParseOrDefault(row.actuality, EventActualitySchema, 'UNKNOWN'),
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
