export {
  createProcessUseCases,
  type ProcessUseCases,
} from '~/modules/shipment/application/processUseCases'
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
} from '~/modules/shipment/domain/process'
export { type ProcessRepository } from '~/modules/shipment/domain/processRepository'
export { supabaseProcessRepository } from '~/modules/shipment/infrastructure/supabaseProcessRepository'
// Merged Process domain into shipment module (MVP migration)
export { CreateProcessDialog } from '~/modules/shipment/ui/CreateProcessDialog'
export { ShipmentView } from '~/modules/shipment/ui/ShipmentView'

import { createProcessUseCases } from '~/modules/shipment/application/processUseCases'
import { supabaseProcessRepository } from '~/modules/shipment/infrastructure/supabaseProcessRepository'

export const processUseCases = createProcessUseCases(supabaseProcessRepository)
