// Domain

// Application
export {
  createProcessUseCases,
  type ProcessUseCases,
} from '~/src/modules/process/application/processUseCases'
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
} from '~/src/modules/process/domain/process'
export { type ProcessRepository } from '~/src/modules/process/domain/processRepository'

// Infrastructure
export { supabaseProcessRepository } from '~/src/modules/process/infrastructure/supabaseProcessRepository'

// UI
export { CreateProcessDialog } from '~/src/modules/process/ui/CreateProcessDialog'

// Default use cases instance (using Supabase repository)
import { createProcessUseCases } from '~/src/modules/process/application/processUseCases'
import { supabaseProcessRepository } from '~/src/modules/process/infrastructure/supabaseProcessRepository'

export const processUseCases = createProcessUseCases(supabaseProcessRepository)
