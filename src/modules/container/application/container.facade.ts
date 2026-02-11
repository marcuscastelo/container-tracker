import type { ContainerRepository } from '~/modules/container/application/container.repository'
import { createCheckContainerExistenceUseCase } from '~/modules/container/application/usecases/check-container-existence.usecase'
import {
  type CreateContainerCommand,
  createCreateContainerUseCase,
} from '~/modules/container/application/usecases/create-container.usecase'
import { createCreateManyContainersUseCase } from '~/modules/container/application/usecases/create-many-containers.usecase'
import { createDeleteContainerUseCase } from '~/modules/container/application/usecases/delete-container.usecase'
import { createFindContainersByNumberUseCase } from '~/modules/container/application/usecases/find-containers-by-number.usecase'
import { createReconcileContainersUseCase } from '~/modules/container/application/usecases/reconcile-containers.usecase'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'
import {
  CannotRemoveLastContainerError,
  DuplicateContainersError,
} from '~/modules/process/application/errors'
import { validateContainerNumber } from '~/modules/process/domain/processStuff'

// Ad-hoc "interface". For now more abstraction would be over-engineering.
type ContainerRepositoryAdHoc = typeof supabaseContainerRepository

/**
 * Normalized container input shape
 */
export type ContainerInput = {
  containerNumber: string
  carrier_code?: string | null
  container_type?: string | null
  container_size?: string | null
}

/**
 * Result of container creation with validation warnings
 */
type CreateContainerResult = {
  container: ContainerEntity
  warnings: string[]
}

/**
 * Result of batch container creation
 */
type CreateManyContainersResult = {
  containers: ContainerEntity[]
  warnings: string[]
}

/**
 * Normalizes a container number to uppercase and trim
 */
function normalizeContainerNumber(containerNumber: string): string {
  return containerNumber.toUpperCase().trim()
}

/**
 * Validates a container number and returns warnings if any
 */
function validateAndWarn(containerNumber: string): string[] {
  const warnings: string[] = []
  const validation = validateContainerNumber(containerNumber)
  if (validation.message) {
    warnings.push(validation.message)
  }
  return warnings
}

/**
 * Container Use Cases
 * Handles container lifecycle: creation, validation, reconciliation
 */
export function createContainerUseCases({
  containerRepository,
}: {
  containerRepository: ContainerRepositoryAdHoc
}) {
  return {
    /**
     * Create a single container with validation
     */
    async createContainer(
      processId: string,
      input: ContainerInput,
    ): Promise<CreateContainerResult> {
      const normalized = normalizeContainerNumber(input.containerNumber)
      const warnings = validateAndWarn(normalized)

      const newContainer: CreateContainerCommand = {
        processId,
        containerNumber: normalized,
        carrierCode: input.carrier_code ?? '',
      }

      const container = await containerRepository.insert(newContainer)
      return {
        container,
        warnings,
      }
    },

    /**
     * Create multiple containers for a process in batch
     */
    async createManyForProcess(
      processId: string,
      inputs: ContainerInput[],
    ): Promise<CreateManyContainersResult> {
      const warnings: string[] = []

      // Normalize and validate all containers
      const normalized = inputs.map((input) => {
        const containerNumber = normalizeContainerNumber(input.containerNumber)
        const inputWarnings = validateAndWarn(containerNumber)
        warnings.push(...inputWarnings)
        return {
          containerNumber,
          carrierCode: input.carrier_code,
          containerType: input.container_type,
          containerSize: input.container_size,
        }
      })

      // Check for duplicates within input
      const seen = new Set<string>()
      const duplicates: string[] = []
      for (const item of normalized) {
        if (seen.has(item.containerNumber)) {
          duplicates.push(item.containerNumber)
        } else {
          seen.add(item.containerNumber)
        }
      }

      if (duplicates.length > 0) {
        throw new DuplicateContainersError(duplicates)
      }

      // Prepare new containers
      const newContainers: CreateContainerCommand[] = normalized.map((item) => ({
        processId,
        containerNumber: item.containerNumber,
        carrierCode: item.carrierCode ?? '',
      }))

      const containers = await containerRepository.insertMany(newContainers)

      return {
        containers,
        warnings,
      }
    },

    /**
     * Check if containers exist in the system (batch check)
     */
    async checkExistence(containerNumbers: string[]): Promise<Map<string, boolean>> {
      const normalized = containerNumbers.map(normalizeContainerNumber)
      const existanceMap = await containerRepository.existsMany(normalized)
      return existanceMap
    },

    /**
     * Find containers by numbers (batch fetch)
     */
    async findByNumbers(containerNumbers: string[]): Promise<ContainerEntity[]> {
      const normalized = containerNumbers.map(normalizeContainerNumber)
      const containers = await containerRepository.findByNumbers(normalized)
      return containers
    },

    /**
     * Reconcile containers for a process:
     * - Add new containers not in current list
     * - Remove containers not in incoming list
     * - Protect against removing last container
     */
    async reconcileForProcess<T extends { id: string; container_number: string }>(
      processId: string,
      existingContainers: readonly T[],
      incomingInputs: ContainerInput[],
    ): Promise<{
      added: ContainerEntity[]
      removed: string[]
      warnings: string[]
    }> {
      const warnings: string[] = []
      const added: ContainerEntity[] = []
      const removed: string[] = []

      // Normalize incoming
      const incoming = incomingInputs.map((item) => ({
        containerNumber: normalizeContainerNumber(item.containerNumber),
        carrier_code: item.carrier_code ?? '',
        container_type: item.container_type,
        container_size: item.container_size,
      }))

      const existingByNumber = new Map(
        existingContainers.map((c) => [normalizeContainerNumber(c.container_number), c]),
      )
      const incomingNumbers = new Set(incoming.map((c) => c.containerNumber))

      // Add new containers
      const toAdd = incoming.filter((inc) => !existingByNumber.has(inc.containerNumber))
      for (const item of toAdd) {
        const itemWarnings = validateAndWarn(item.containerNumber)
        warnings.push(...itemWarnings)

        const newContainer: CreateContainerCommand = {
          processId,
          containerNumber: item.containerNumber,
          carrierCode: item.carrier_code,
        }

        const container = await containerRepository.insert(newContainer)
        added.push(container)
      }

      // Remove containers not in incoming
      const toRemove = existingContainers.filter(
        (ex) => !incomingNumbers.has(normalizeContainerNumber(ex.container_number)),
      )

      for (const container of toRemove) {
        // Protection: cannot remove last container
        const currentCount = existingContainers.length - removed.length
        if (currentCount <= 1) {
          warnings.push(
            `Cannot remove container ${container.container_number}: it is the last container in the process`,
          )
          continue
        }

        await containerRepository.delete(container.id)
        removed.push(container.id)
      }

      return { added, removed, warnings }
    },

    /**
     * Delete a container by ID with protection against removing last container
     */
    async deleteContainer<T extends { id: string; container_number: string }>(
      containerId: string,
      processId: string,
      currentContainers: readonly T[],
    ): Promise<void> {
      if (currentContainers.length <= 1) {
        throw new CannotRemoveLastContainerError(processId, containerId)
      }

      await containerRepository.delete(containerId)
    },
  }
}

/**
 * ContainerFacade
 *
 * Single entry point for container application layer.
 * No business logic here.
 * Only dependency wiring.
 */
export function createContainerFacade(deps: { repository: ContainerRepository }) {
  const createContainer = createCreateContainerUseCase(deps)
  const createManyForProcess = createCreateManyContainersUseCase(deps)
  const reconcileForProcess = createReconcileContainersUseCase(deps)
  const deleteContainer = createDeleteContainerUseCase(deps)
  const checkExistence = createCheckContainerExistenceUseCase(deps)
  const findByNumbers = createFindContainersByNumberUseCase(deps)

  return {
    createContainer,
    createManyForProcess,
    reconcileForProcess,
    deleteContainer,
    checkExistence,
    findByNumbers,
  }
}

export type ContainerFacade = ReturnType<typeof createContainerFacade>
