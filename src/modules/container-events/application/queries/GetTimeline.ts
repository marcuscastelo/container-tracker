import type { ContainerEvent } from '~/modules/container-events/domain/ContainerEvent'
import { supabaseContainerEventRepository } from '~/modules/container-events/infrastructure/persistence/supabaseContainerEventRepository'

export async function getTimeline(containerNumber: string): Promise<ContainerEvent[]> {
  const result = await supabaseContainerEventRepository.findByContainer(containerNumber)
  if (result.success) {
    return result.data
  }
  console.error(`Failed to get timeline for container ${containerNumber}:`, result.error)
  return []
}
