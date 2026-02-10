// Domain

// Application
export {
  type ContainerInput,
  type CreateContainerResult,
  type CreateManyContainersResult,
  createContainerUseCases,
  normalizeContainerNumber,
  validateAndWarn,
} from '~/modules/container/application/containerUseCases'
export {
  type Container,
  ContainerSchema,
  type NewContainer,
  NewContainerSchema,
} from '~/modules/container/domain/container'

// Infrastructure
export { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'

// Default use cases instance (using Supabase repository)
import { createContainerUseCases } from '~/modules/container/application/containerUseCases'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'

export const containerUseCases = createContainerUseCases({
  containerRepository: supabaseContainerRepository,
})
