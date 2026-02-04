// Domain

// Application
export {
  type ContainerStatusUseCases,
  createContainerStatusUseCases,
} from '~/modules/container/application/containerStatusUseCases'
export {
  type ContainerStatus,
  containerStatusSchema,
  createContainerStatus,
  type NewContainerStatus,
  newContainerStatusSchema,
} from '~/modules/container/domain/containerStatus'
export { type ContainerStatusRepository } from '~/modules/container/domain/containerStatusRepository'
// Infrastructure
export { supabaseContainerStatusRepository } from '~/modules/container/infrastructure/supabaseContainerStatusRepository'

import { createContainerStatusUseCases } from '~/modules/container/application/containerStatusUseCases'
// Default use cases instance (using Supabase repository)
import { supabaseContainerStatusRepository } from '~/modules/container/infrastructure/supabaseContainerStatusRepository'

export const containerStatusUseCases = createContainerStatusUseCases(
  supabaseContainerStatusRepository,
)
