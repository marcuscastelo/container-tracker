import type { Container, NewContainer } from '~/modules/container/domain/container'
import type { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'
import type { NewProcess, Process } from '~/modules/process/domain/process'
import type {
  CreateProcessInput,
  ProcessWithContainers,
} from '~/modules/process/domain/processStuff'
import {
  createProcess,
  findDuplicateContainers,
  validateContainerNumber,
} from '~/modules/process/domain/processStuff'
import type { Carrier, OperationType } from '~/modules/process/domain/value-objects'
import type { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

// Ad-hoc "interface". For now more abstraction would be over-engineering.
type ProcessRepository = typeof supabaseProcessRepository
type ContainerRepository = typeof supabaseContainerRepository

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

export function createProcessUseCases({
  processRepository,
  containerRepository,
}: {
  processRepository: ProcessRepository
  containerRepository: ContainerRepository
}) {
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
        const exists = await processRepository.containerExists(c.container_number)
        if (exists) {
          throw new Error(
            `Container ${c.container_number.toUpperCase()} already exists in the system`,
          )
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

      const newContainers = input.containers.map(
        (c) =>
          ({
            carrier_code: c.carrier_code,
            container_number: c.container_number.toUpperCase().trim(),
            process_id: process.id,
          }) satisfies NewContainer,
      )

      const containerResult = await containerRepository.insertMany(newContainers)
      if (!containerResult.success) {
        throw new Error(
          `Failed to add containers to process: ${containerResult.error?.message ?? 'Unknown error'}`,
        )
      }
      const containers = containerResult.data

      return { process, containers, warnings }
    },

    async addContainer(container: NewContainer): Promise<{
      container: Container
      warnings: string[]
    }> {
      const warnings: string[] = []

      // Validate container number
      const validation = validateContainerNumber(container.container_number)
      if (validation.message) {
        warnings.push(validation.message)
      }

      // Check if container exists
      // TODO: Allow DB to enforce uniqueness and handle conflict error instead of pre-checking? Which one is cheaper at scale?
      // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/12
      const exists = await processRepository.containerExists(container.container_number)
      if (exists) {
        throw new Error(
          `Container ${container.container_number.toUpperCase()} already exists in the system`,
        )
      }

      const result = await containerRepository.insert({
        process_id: container.process_id,
        container_number: container.container_number.toUpperCase().trim(),
        carrier_code: container.carrier_code,
      })
      if (!result.success) {
        throw new Error(`Failed to add container: ${result.error?.message ?? 'Unknown error'}`)
      }
      const created = result.data

      return { container: created, warnings }
    },

    async deleteProcess(processId: string) {
      return processRepository.delete(processId)
    },

    async removeContainer(containerId: string, processId: string) {
      // Check if this is the last container
      const containers = await processRepository.fetchContainersByProcessId(processId)
      if (containers.length <= 1) {
        throw new Error('Cannot remove the last container from a process')
      }

      return processRepository.removeContainer(containerId)
    },

    async updateProcess(processId: string, input: Partial<CreateProcessInput>) {
      // Reconcile containers if provided
      if (input.containers) {
        const existing = await processRepository.fetchContainersByProcessId(processId)
        const existingByNumber = new Map(existing.map((c) => [c.container_number.toUpperCase(), c]))

        // Normalize incoming containers (accept either UI shape or API shape)
        const incoming = (Array.isArray(input.containers) ? input.containers : []).map((item) => ({
          containerNumber: item.container_number.toUpperCase().trim(),
          carrier_code: item.carrier_code ?? null,
        }))

        const incomingNumbers = incoming.map((c) => c.containerNumber)

        // Add new containers
        for (const inc of incoming) {
          if (!existingByNumber.has(inc.containerNumber)) {
            await containerRepository.insert({
              carrier_code: inc.carrier_code,
              container_number: inc.containerNumber,
              process_id: processId,
            })
          }
        }

        // Remove containers that are not in incoming list
        for (const ex of existing) {
          if (!incomingNumbers.includes(ex.container_number.toUpperCase())) {
            // Ensure we don't remove last container
            const all = await processRepository.fetchContainersByProcessId(processId)
            if (all.length <= 1) {
              // skip removal to avoid leaving process without containers
              continue
            }
            await processRepository.removeContainer(ex.id)
          }
        }
      }

      // Map field names from CreateProcessInput -> repository update shape
      const updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>> = {}
      if (input.reference !== undefined) updates.reference = input.reference
      if (input.operation_type !== undefined) updates.operation_type = input.operation_type
      if (input.origin !== undefined) updates.origin = input.origin
      if (input.destination !== undefined) updates.destination = input.destination
      if (input.carrier !== undefined) updates.carrier = input.carrier
      if (input.bill_of_lading !== undefined) updates.bill_of_lading = input.bill_of_lading
      console.debug('processUseCases.updateProcess: full input', input)
      console.debug('processUseCases.updateProcess: updates to apply', updates)
      // Call repository.update for provided fields
      if (Object.keys(updates).length > 0) {
        // repository.update expects partial Process fields with repository naming
        await processRepository.update(processId, updates)
      }

      const updated = await processRepository.fetchByIdWithContainers(processId)
      if (!updated) throw new Error('Process not found after update')
      return updated
    },
  }
}
