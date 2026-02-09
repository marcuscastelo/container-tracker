import type { ContainerEvent } from '~/modules/container-events/domain/ContainerEvent'
import { supabaseContainerEventRepository } from '~/modules/container-events/infrastructure/persistence/supabaseContainerEventRepository'

export async function appendEvents(events: ContainerEvent[]) {
  await supabaseContainerEventRepository.insertMany(events)
}
