import {
  type ContainerInput,
  createContainerUseCases,
} from '~/modules/container/application/containerUseCases'
import type { Container, NewContainer } from '~/modules/container/domain/container'
import type { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'
import {
  CannotRemoveLastContainerError,
  ContainerAlreadyExistsError,
} from '~/modules/process/application/errors'
import type { NewProcess, Process } from '~/modules/process/domain/process'
import type {
  CreateProcessInput,
  ProcessWithContainers,
} from '~/modules/process/domain/processStuff'
import { createProcess } from '~/modules/process/domain/processStuff'
import type { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

// Ad-hoc "interface". For now more abstraction would be over-engineering.
type ProcessRepository = typeof supabaseProcessRepository
type ContainerRepository = typeof supabaseContainerRepository

export function createProcessUseCases({
  processRepository,
  containerRepository,
}: {
  processRepository: ProcessRepository
  containerRepository: ContainerRepository
}) {
  const containerUseCases = createContainerUseCases({ containerRepository })

  return {
    async getAllProcesses(): Promise<readonly Process[]> {
      return processRepository.fetchAll()
    },

    async getAllProcessesWithContainers(): Promise<readonly ProcessWithContainers[]> {
      return processRepository.fetchAllWithContainers()
    },

    async getProcess(processId: string): Promise<Process | null> {
      return processRepository.fetchById(processId)
    },

    async getProcessWithContainers(processId: string): Promise<ProcessWithContainers | null> {
      return processRepository.fetchByIdWithContainers(processId)
    },

    async createProcess(input: CreateProcessInput) {
      // Convert input containers to ContainerInput format
      const containerInputs: ContainerInput[] = input.containers.map((c) => ({
        containerNumber: c.container_number,
        carrier_code: c.carrier_code,
      }))

      // Check for existing containers in the system (batch check)
      const containerNumbers = containerInputs.map((c) => c.containerNumber)
      const existenceMap = await containerUseCases.checkExistence(containerNumbers)

      for (const [containerNumber, exists] of existenceMap.entries()) {
        if (exists) {
          // Fetch the existing container for detailed error
          const existing = await processRepository.fetchContainerByNumber(containerNumber)
          throw new ContainerAlreadyExistsError(containerNumber, existing)
        }
      }

      // Create the process
      const newProcess: NewProcess = createProcess(input)
      const processResult = await processRepository.create(newProcess)
      if (!processResult.success) {
        throw new Error(
          `Failed to create process: ${processResult.error?.message ?? 'Unknown error'}`,
        )
      }
      const process: Process = processResult.data

      // Delegate container creation to containerUseCases
      const { containers, warnings } = await containerUseCases.createManyForProcess(
        process.id,
        containerInputs,
      )

      return { process, containers, warnings }
    },

    async addContainer(container: NewContainer): Promise<{
      container: Container
      warnings: string[]
    }> {
      // Check if container exists
      const exists = await processRepository.containerExists(container.container_number)
      if (exists) {
        const existing = await processRepository.fetchContainerByNumber(container.container_number)
        throw new ContainerAlreadyExistsError(container.container_number, existing)
      }

      const containerInput: ContainerInput = {
        containerNumber: container.container_number,
        carrier_code: container.carrier_code,
      }

      return containerUseCases.createContainer(container.process_id, containerInput)
    },

    async deleteProcess(processId: string) {
      return processRepository.delete(processId)
    },

    async removeContainer(containerId: string, processId: string) {
      const containers = await processRepository.fetchContainersByProcessId(processId)
      await containerUseCases.deleteContainer(containerId, processId, containers)
    },

    async updateProcess(processId: string, input: Partial<CreateProcessInput>) {
      // Reconcile containers if provided
      if (input.containers) {
        const existing = await processRepository.fetchContainersByProcessId(processId)

        const containerInputs: ContainerInput[] = input.containers.map((c) => ({
          containerNumber: c.container_number,
          carrier_code: c.carrier_code,
        }))

        await containerUseCases.reconcileForProcess(processId, existing, containerInputs)
      }

      // Map field names from CreateProcessInput -> repository update shape
      const updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>> = {}
      if (input.reference !== undefined) updates.reference = input.reference
      if (input.origin !== undefined) updates.origin = input.origin
      if (input.destination !== undefined) updates.destination = input.destination
      if (input.carrier !== undefined) updates.carrier = input.carrier
      if (input.bill_of_lading !== undefined) updates.bill_of_lading = input.bill_of_lading
      if (input.booking_number !== undefined) updates.booking_number = input.booking_number
      if (input.importer_name !== undefined) updates.importer_name = input.importer_name
      if (input.exporter_name !== undefined) updates.exporter_name = input.exporter_name
      if (input.reference_importer !== undefined)
        updates.reference_importer = input.reference_importer
      if (input.product !== undefined) updates.product = input.product
      if (input.redestination_number !== undefined)
        updates.redestination_number = input.redestination_number

      // Call repository.update for provided fields
      if (Object.keys(updates).length > 0) {
        await processRepository.update(processId, updates)
      }

      const updated = await processRepository.fetchByIdWithContainers(processId)
      if (!updated) throw new Error('Process not found after update')
      return updated
    },
  }
}
