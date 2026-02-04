// Domain

// Application
export {
  createProcessUseCases,
  type ProcessUseCases,
} from './application/processUseCases'
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
} from './domain/process'
export { type ProcessRepository } from './domain/processRepository'

// Infrastructure
export { supabaseProcessRepository } from './infrastructure/supabaseProcessRepository'

// UI
export { CreateProcessDialog } from './ui/CreateProcessDialog'

// Default use cases instance (using Supabase repository)
import { createProcessUseCases } from './application/processUseCases'
import { supabaseProcessRepository } from './infrastructure/supabaseProcessRepository'

export const processUseCases = createProcessUseCases(supabaseProcessRepository)
