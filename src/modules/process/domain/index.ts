// Domain surface for the `process` module.

export { type Process, ProcessSchema } from '~/modules/process/domain/process'
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
  CarrierSchema,
  ContainerInitialStatus,
  PlannedLocation,
  ProcessSourceSchema as ProcessSource,
} from '~/modules/process/domain/value-objects'
