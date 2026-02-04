import type {
  CreateProcessInput,
  Process,
  ProcessContainer,
  ProcessWithContainers,
} from '../domain/process'
import { createProcess, findDuplicateContainers, validateContainerNumber } from '../domain/process'
import type { ProcessRepository } from '../domain/processRepository'

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
    container: { container_number: string; iso_type?: string | null },
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
        iso_type: container.iso_type ?? null,
        initial_status: 'unknown',
        source: 'manual',
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
  }
}
