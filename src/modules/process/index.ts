// Domain

// Application
export {
  createProcessUseCases,
  type ProcessUseCases,
} from '~/modules/process/application/processUseCases'
export { type ProcessRepository } from '~/modules/process/domain/processRepository'
export {
  type Carrier,
  type ContainerInitialStatus,
  type CreateProcessInput,
  CreateProcessInputSchema,
  createProcess,
  findDuplicateContainers,
  type OperationType,
  type PlannedLocation,
  type Process,
  type ProcessContainer,
  ProcessContainerSchema,
  ProcessSchema,
  type ProcessSource,
  type ProcessWithContainers,
  ProcessWithContainersSchema,
  validateContainerNumber,
} from '~/modules/process/domain/processStuff'

// Infrastructure
export { supabaseProcessRepository } from '~/modules/process/infrastructure/supabaseProcessRepository'

// UI
export { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'

// Default use cases instance (using Supabase repository)
import { createProcessUseCases } from '~/modules/process/application/processUseCases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/supabaseProcessRepository'

export const processUseCases = createProcessUseCases(supabaseProcessRepository)
