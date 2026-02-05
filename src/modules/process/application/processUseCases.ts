import type { Carrier, OperationType, Process } from '~/modules/process/domain'
import type { ProcessRepository } from '~/modules/process/domain/processRepository'
import type {
  CreateProcessInput,
  ProcessContainer,
  ProcessWithContainers,
} from '~/modules/process/domain/processStuff'
import {
  createProcess,
  findDuplicateContainers,
  validateContainerNumber,
} from '~/modules/process/domain/processStuff'
import { isRecord } from '~/shared/utils/typeGuards'

// Input shape used by updateProcess - UI-friendly field names
export type UpdateProcessInput = {
  reference?: string | null
  operationType?: OperationType
  origin?: unknown
  destination?: unknown
  carrier?: Carrier | null
  billOfLading?: string | null
  containers?: Array<{
    containerNumber: string
    container_type?: string | null
    container_size?: string | null
    carrier_code?: string | null
  }>
}

/**
 * Process Use Cases
 *
 * Application layer that orchestrates domain logic and repository calls.
 */
export type ProcessUseCases = {
  /**
   * Get all processes (without containers)
   */
  getAllProcesses: () => Promise<readonly Process[]>

  /**
   * Get all processes with their containers
   */
  getAllProcessesWithContainers: () => Promise<readonly ProcessWithContainers[]>

  /**
   * Get a single process by ID
   */
  getProcess: (processId: string) => Promise<Process | null>

  /**
   * Get a process with its containers
   */
  getProcessWithContainers: (processId: string) => Promise<ProcessWithContainers | null>

  /**
   * Create a new process with containers
   * Validates container numbers and checks for duplicates
   */
  createProcess: (input: CreateProcessInput) => Promise<{
    process: ProcessWithContainers
    warnings: readonly string[]
  }>

  /**
   * Add a container to an existing process
   */
  addContainer: (
    processId: string,
    container: {
      container_number: string
      container_type?: string | null
      container_size?: string | null
      carrier_code?: string | null
    },
  ) => Promise<{
    container: ProcessContainer
    warnings: readonly string[]
  }>

  /**
   * Delete a process and all its containers
   */
  deleteProcess: (processId: string) => Promise<void>

  /**
   * Remove a container from a process
   */
  removeContainer: (containerId: string, processId: string) => Promise<void>

  /**
   * Update a process and reconcile its containers (add/remove)
   */
  updateProcess: (processId: string, input: UpdateProcessInput) => Promise<ProcessWithContainers>
}

export function createProcessUseCases(repository: ProcessRepository): ProcessUseCases {
  return {
    async getAllProcesses() {
      return repository.fetchAll()
    },

    async getAllProcessesWithContainers() {
      return repository.fetchAllWithContainers()
    },

    async getProcess(processId) {
      return repository.fetchById(processId)
    },

    async getProcessWithContainers(processId) {
      return repository.fetchByIdWithContainers(processId)
    },

    async createProcess(input) {
      const warnings: string[] = []

      // Validate container numbers
      for (const c of input.containers) {
        const validation = validateContainerNumber(c.container_number)
        if (validation.message) {
          warnings.push(validation.message)
        }
      }

      // Check for duplicates within input
      const containerNumbers = input.containers.map((c) => c.container_number)
      const duplicatesInInput = findDuplicateContainers(containerNumbers)
      if (duplicatesInInput.length > 0) {
        throw new Error(`Duplicate container numbers in request: ${duplicatesInInput.join(', ')}`)
      }

      // Check for existing containers in the system
      for (const c of input.containers) {
        const exists = await repository.containerExists(c.container_number)
        if (exists) {
          throw new Error(
            `Container ${c.container_number.toUpperCase()} already exists in the system`,
          )
        }
      }

      // Create the process
      const { process, containers } = createProcess(input)
      const created = await repository.create(process, containers)

      return { process: created, warnings }
    },

    async addContainer(processId, container) {
      const warnings: string[] = []

      // Validate container number
      const validation = validateContainerNumber(container.container_number)
      if (validation.message) {
        warnings.push(validation.message)
      }

      // Check if container exists
      const exists = await repository.containerExists(container.container_number)
      if (exists) {
        throw new Error(
          `Container ${container.container_number.toUpperCase()} already exists in the system`,
        )
      }

      // Add the container
      const created = await repository.addContainer(processId, {
        container_number: container.container_number.toUpperCase().trim(),
        carrier_code: container.carrier_code ?? null,
        container_type: container.container_type ?? null,
        container_size: container.container_size ?? null,
      })

      return { container: created, warnings }
    },

    async deleteProcess(processId) {
      return repository.delete(processId)
    },

    async removeContainer(containerId, processId) {
      // Check if this is the last container
      const containers = await repository.fetchContainersByProcessId(processId)
      if (containers.length <= 1) {
        throw new Error('Cannot remove the last container from a process')
      }

      return repository.removeContainer(containerId)
    },

    async updateProcess(processId, input) {
      // Reconcile containers if provided
      if (input.containers) {
        const existing = await repository.fetchContainersByProcessId(processId)
        const existingByNumber = new Map(existing.map((c) => [c.container_number.toUpperCase(), c]))

        // Normalize incoming containers (accept either UI shape or API shape)
        const incoming = (Array.isArray(input.containers) ? input.containers : []).map((c) => {
          const item = isRecord(c) ? c : {}
          const containerNumber = String(item.containerNumber ?? item.container_number ?? '')
            .toUpperCase()
            .trim()
          const container_type =
            typeof item.container_type === 'string'
              ? item.container_type
              : typeof item.containerType === 'string'
                ? item.containerType
                : null
          const container_size =
            typeof item.container_size === 'string'
              ? item.container_size
              : typeof item.containerSize === 'string'
                ? item.containerSize
                : null
          const carrier_code = typeof item.carrier_code === 'string' ? item.carrier_code : null
          return {
            containerNumber,
            container_type,
            container_size,
            carrier_code,
          }
        })

        const incomingNumbers = incoming.map((c) => c.containerNumber)

        // Add new containers
        for (const inc of incoming) {
          if (!existingByNumber.has(inc.containerNumber)) {
            await repository.addContainer(processId, {
              container_number: inc.containerNumber,
              carrier_code: inc.carrier_code ?? null,
              container_type: inc.container_type ?? null,
              container_size: inc.container_size ?? null,
            })
          }
        }

        // Remove containers that are not in incoming list
        for (const ex of existing) {
          if (!incomingNumbers.includes(ex.container_number.toUpperCase())) {
            // Ensure we don't remove last container
            const all = await repository.fetchContainersByProcessId(processId)
            if (all.length <= 1) {
              // skip removal to avoid leaving process without containers
              continue
            }
            await repository.removeContainer(ex.id)
          }
        }
      }

      // Map field names from CreateProcessInput -> repository update shape
      const updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>> = {}
      if (input.reference !== undefined) updates.reference = input.reference
      if (input.operationType !== undefined) updates.operation_type = input.operationType
      if (input.origin !== undefined) updates.origin = input.origin
      if (input.destination !== undefined) updates.destination = input.destination
      if (input.carrier !== undefined) updates.carrier = input.carrier
      if (input.billOfLading !== undefined) updates.bill_of_lading = input.billOfLading
      console.debug('processUseCases.updateProcess: full input', input)
      console.debug('processUseCases.updateProcess: updates to apply', updates)
      // Call repository.update for provided fields
      if (Object.keys(updates).length > 0) {
        // repository.update expects partial Process fields with repository naming
        await repository.update(processId, updates)
      }

      const updated = await repository.fetchByIdWithContainers(processId)
      if (!updated) throw new Error('Process not found after update')
      return updated
    },
  }
}
