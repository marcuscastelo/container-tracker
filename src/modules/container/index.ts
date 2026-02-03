// Domain
export {
  type ContainerStatus,
  type NewContainerStatus,
  containerStatusSchema,
  newContainerStatusSchema,
  createContainerStatus,
} from './domain/containerStatus'

export { type ContainerStatusRepository } from './domain/containerStatusRepository'

// Infrastructure
export { supabaseContainerStatusRepository } from './infrastructure/supabaseContainerStatusRepository'

// Application
export {
  type ContainerStatusUseCases,
  createContainerStatusUseCases,
} from './application/containerStatusUseCases'

// Default use cases instance (using Supabase repository)
import { supabaseContainerStatusRepository } from './infrastructure/supabaseContainerStatusRepository'
import { createContainerStatusUseCases } from './application/containerStatusUseCases'

export const containerStatusUseCases = createContainerStatusUseCases(
  supabaseContainerStatusRepository,
)
