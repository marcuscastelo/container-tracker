import {
  type ContainerInput,
  createContainerUseCases,
} from '~/modules/container/application/container.facade'
import type { CreateContainerCommand } from '~/modules/container/application/usecases/create-container.usecase'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'
import { ContainerAlreadyExistsError } from '~/modules/process/application/errors'
import type { NewProcess, Process } from '~/modules/process/domain/process'
import type {
  CreateProcessInput,
  ProcessWithContainers,
} from '~/modules/process/domain/processStuff'
import { createProcess } from '~/modules/process/domain/processStuff'
import type { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'
import { InfrastructureError, NotFoundError } from '~/shared/errors/httpErrors'

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
      return await processRepository.fetchAll()
    },

    async getAllProcessesWithContainers(): Promise<readonly ProcessWithContainers[]> {
      return await processRepository.fetchAllWithContainers()
    },

    async getProcess(processId: string): Promise<Process | null> {
      return await processRepository.fetchById(processId)
    },

    async getProcessWithContainers(processId: string): Promise<ProcessWithContainers | null> {
      return await processRepository.fetchByIdWithContainers(processId)
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
          if (existing) throw new ContainerAlreadyExistsError(containerNumber, existing)
        }
      }

      // Create the process
      const newProcess: NewProcess = createProcess(input)
      const process: Process = await processRepository.create(newProcess)

      // Delegate container creation to containerUseCases
      const { containers, warnings } = await containerUseCases.createManyForProcess(
        process.id,
        containerInputs,
      )

      return { process, containers, warnings }
    },

    async addContainer(container: CreateContainerCommand): Promise<{
      container: ContainerEntity
      warnings: string[]
    }> {
      // Check if container exists
      const exists = await processRepository.containerExists(container.containerNumber)
      if (exists) {
        const existing = await processRepository.fetchContainerByNumber(container.containerNumber)
        if (existing) throw new ContainerAlreadyExistsError(container.containerNumber, existing)
      }

      const containerInput: ContainerInput = {
        containerNumber: container.containerNumber,
        carrier_code: container.carrierCode,
      }

      return containerUseCases.createContainer(container.processId, containerInput)
    },

    async deleteProcess(processId: string) {
      await processRepository.delete(processId)
      return
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

      const fetched = await processRepository.fetchByIdWithContainers(processId)
      if (!fetched) throw new NotFoundError('Process not found after update')
      return fetched
    },
  }
}
