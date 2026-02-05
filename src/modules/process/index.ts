// Domain

// Application
export {
  createProcessUseCases,
  type ProcessUseCases,
} from '~/modules/process/application/processUseCases'
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
  type ProcessRepository,
  ProcessSchema,
  type ProcessSource,
  type ProcessWithContainers,
  ProcessWithContainersSchema,
  validateContainerNumber,
} from '~/modules/process/domain'

// Infrastructure
export { supabaseProcessRepository } from '~/modules/process/infrastructure/supabaseProcessRepository'

// UI
export { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'

// Default use cases instance (using Supabase repository)
import { createProcessUseCases } from '~/modules/process/application/processUseCases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/supabaseProcessRepository'

export const processUseCases = createProcessUseCases(supabaseProcessRepository)
