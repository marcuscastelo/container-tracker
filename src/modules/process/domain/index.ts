// Domain surface for the `process` module.

export { type Process, ProcessSchema } from '~/modules/process/domain/process'
export { type ProcessRepository } from '~/modules/process/domain/processRepository'
export {
  type CreateProcessInput,
  CreateProcessInputSchema,
  createProcess,
  findDuplicateContainers,
  type ProcessContainer,
  ProcessContainerSchema,
  type ProcessWithContainers,
  ProcessWithContainersSchema,
  validateContainerNumber,
} from '~/modules/process/domain/processStuff'

export {
  Carrier,
  ContainerInitialStatus,
  OperationType,
  PlannedLocation,
  ProcessSource,
} from '~/modules/process/domain/value-objects'
