// Domain

export {
  CannotRemoveLastContainerError,
  ContainerAlreadyExistsError,
  DuplicateContainersError,
  parseContainerExistsError,
  resolveContainerOwner,
} from '~/modules/process/application/errors'
// Application
export { createProcessUseCases } from '~/modules/process/application/processUseCases'
export {
  type ContainerInitialStatus,
  type CreateProcessInput,
  CreateProcessInputSchema,
  createProcess,
  findDuplicateContainers,
  type PlannedLocation,
  type Process,
  type ProcessContainer,
  ProcessContainerSchema,
  ProcessSchema,
  type ProcessSource,
  type ProcessWithContainers,
  ProcessWithContainersSchema,
  validateContainerNumber,
} from '~/modules/process/domain'

// Infrastructure
export { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

// UI
export { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'

import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'
// Default use cases instance (using Supabase repository)
import { createProcessUseCases } from '~/modules/process/application/processUseCases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

export const processUseCases = createProcessUseCases({
  processRepository: supabaseProcessRepository,
  containerRepository: supabaseContainerRepository,
})
