import type { Container, NewContainer } from '~/modules/container/domain/container'
import type { Database } from '~/shared/supabase/database.types'

type ContainerRow = Database['public']['Tables']['containers']['Row']
type ContainerInsert = Database['public']['Tables']['containers']['Insert']
type ContainerUpdate = Database['public']['Tables']['containers']['Update']

export const containerMappers = {
  fromRow: (row: ContainerRow): Container => ({
    id: row.id,
    container_number: row.container_number,
    carrier_code: row.carrier_code,
    process_id: row.process_id,
  }),

  toInsert: (container: NewContainer): ContainerInsert => ({
    carrier_code: container.carrier_code,
    container_number: container.container_number,
    process_id: container.process_id,
    container_size: null, // TODO: Implement container size and type inference based on events or external data
    container_type: null, // TODO: Implement container size and type inference based on events or external data
  }),

  toUpdate: (container: NewContainer): ContainerUpdate => ({
    carrier_code: container.carrier_code,
    container_number: container.container_number,
    process_id: container.process_id,
    container_size: null, // TODO: Implement container size and type inference based on events or external data
    container_type: null, // TODO: Implement container size and type inference based on events or external data
  }),
}
