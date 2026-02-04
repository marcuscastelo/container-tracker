// Domain

// Application
export {
  type ContainerStatusUseCases,
  createContainerStatusUseCases,
} from '~/src/modules/container/application/containerStatusUseCases'
export {
  type ContainerStatus,
  containerStatusSchema,
  createContainerStatus,
  type NewContainerStatus,
  newContainerStatusSchema,
} from '~/src/modules/container/domain/containerStatus'
export { type ContainerStatusRepository } from '~/src/modules/container/domain/containerStatusRepository'
// Infrastructure
export { supabaseContainerStatusRepository } from '~/src/modules/container/infrastructure/supabaseContainerStatusRepository'

import { createContainerStatusUseCases } from '~/src/modules/container/application/containerStatusUseCases'
// Default use cases instance (using Supabase repository)
import { supabaseContainerStatusRepository } from '~/src/modules/container/infrastructure/supabaseContainerStatusRepository'

export const containerStatusUseCases = createContainerStatusUseCases(
  supabaseContainerStatusRepository,
)
