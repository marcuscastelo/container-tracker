// Domain

// Application
export {
  type ContainerStatusUseCases,
  createContainerStatusUseCases,
} from './application/containerStatusUseCases'
export {
  type ContainerStatus,
  containerStatusSchema,
  createContainerStatus,
  type NewContainerStatus,
  newContainerStatusSchema,
} from './domain/containerStatus'
export { type ContainerStatusRepository } from './domain/containerStatusRepository'
// Infrastructure
export { supabaseContainerStatusRepository } from './infrastructure/supabaseContainerStatusRepository'

import { createContainerStatusUseCases } from './application/containerStatusUseCases'
// Default use cases instance (using Supabase repository)
import { supabaseContainerStatusRepository } from './infrastructure/supabaseContainerStatusRepository'

export const containerStatusUseCases = createContainerStatusUseCases(
  supabaseContainerStatusRepository,
)
