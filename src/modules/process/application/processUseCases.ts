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
      const result = await processRepository.fetchAll()
      if (!result.success) throw result.error
      return result.data
    },

    async getAllProcessesWithContainers(): Promise<readonly ProcessWithContainers[]> {
      const result = await processRepository.fetchAllWithContainers()
      if (!result.success) throw result.error
      return result.data
    },

    async getProcess(processId: string): Promise<Process | null> {
      const result = await processRepository.fetchById(processId)
      if (!result.success) {
        throw result.error
      }
      return result.data
    },

    async getProcessWithContainers(processId: string): Promise<ProcessWithContainers | null> {
      const result = await processRepository.fetchByIdWithContainers(processId)
      if (!result.success) throw result.error
      return result.data
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
          const existingResult = await processRepository.fetchContainerByNumber(containerNumber)
          if (!existingResult.success) throw existingResult.error
          throw new ContainerAlreadyExistsError(containerNumber, existingResult.data)
        }
      }

      // Create the process
      const newProcess: NewProcess = createProcess(input)
      const processResult = await processRepository.create(newProcess)
      if (!processResult.success) {
        throw new InfrastructureError(
          `Failed to create process: ${processResult.error?.message ?? 'Unknown error'}`,
          processResult.error ?? undefined,
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

    async addContainer(container: CreateContainerCommand): Promise<{
      container: ContainerEntity
      warnings: string[]
    }> {
      // Check if container exists
      const existsResult = await processRepository.containerExists(container.containerNumber)
      if (!existsResult.success) throw existsResult.error
      if (existsResult.data) {
        const existingResult = await processRepository.fetchContainerByNumber(
          container.containerNumber,
        )
        if (!existingResult.success) throw existingResult.error
        throw new ContainerAlreadyExistsError(container.containerNumber, existingResult.data)
      }

      const containerInput: ContainerInput = {
        containerNumber: container.containerNumber,
        carrier_code: container.carrierCode,
      }

      return containerUseCases.createContainer(container.processId, containerInput)
    },

    async deleteProcess(processId: string) {
      const result = await processRepository.delete(processId)
      if (!result.success) throw result.error
      return
    },

    async removeContainer(containerId: string, processId: string) {
      const containersResult = await processRepository.fetchContainersByProcessId(processId)
      if (!containersResult.success) throw containersResult.error
      await containerUseCases.deleteContainer(containerId, processId, containersResult.data)
    },

    async updateProcess(processId: string, input: Partial<CreateProcessInput>) {
      // Reconcile containers if provided
      if (input.containers) {
        const existingResult = await processRepository.fetchContainersByProcessId(processId)
        if (!existingResult.success) throw existingResult.error
        const existing = existingResult.data

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
        const updateResult = await processRepository.update(processId, updates)
        if (!updateResult.success) throw updateResult.error
      }

      const fetched = await processRepository.fetchByIdWithContainers(processId)
      if (!fetched.success) throw fetched.error
      if (!fetched.data) throw new NotFoundError('Process not found after update')
      return fetched.data
    },
  }
}
