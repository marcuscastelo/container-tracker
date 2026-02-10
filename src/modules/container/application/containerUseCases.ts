import type { Container, NewContainer } from '~/modules/container/domain/container'
import type { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'
import {
  CannotRemoveLastContainerError,
  DuplicateContainersError,
} from '~/modules/process/application/errors'
import { validateContainerNumber } from '~/modules/process/domain/processStuff'
import { InfrastructureError } from '~/shared/errors/httpErrors'

// Ad-hoc "interface". For now more abstraction would be over-engineering.
type ContainerRepository = typeof supabaseContainerRepository

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
export type CreateContainerResult = {
  container: Container
  warnings: string[]
}

/**
 * Result of batch container creation
 */
export type CreateManyContainersResult = {
  containers: Container[]
  warnings: string[]
}

/**
 * Normalizes a container number to uppercase and trim
 */
export function normalizeContainerNumber(containerNumber: string): string {
  return containerNumber.toUpperCase().trim()
}

/**
 * Validates a container number and returns warnings if any
 */
export function validateAndWarn(containerNumber: string): string[] {
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
  containerRepository: ContainerRepository
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

      const newContainer: NewContainer = {
        process_id: processId,
        container_number: normalized,
        carrier_code: input.carrier_code ?? '',
      }

      const result = await containerRepository.insert(newContainer)
      if (!result.success) {
        throw new InfrastructureError(
          `Failed to create container: ${result.error?.message ?? 'Unknown error'}`,
          result.error ?? undefined,
        )
      }

      return {
        container: result.data,
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
          carrier_code: input.carrier_code,
          container_type: input.container_type,
          container_size: input.container_size,
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
      const newContainers: NewContainer[] = normalized.map((item) => ({
        process_id: processId,
        container_number: item.containerNumber,
        carrier_code: item.carrier_code ?? '',
      }))

      const result = await containerRepository.insertMany(newContainers)
      if (!result.success) {
        throw new InfrastructureError(
          `Failed to create containers: ${result.error?.message ?? 'Unknown error'}`,
          result.error ?? undefined,
        )
      }

      return {
        containers: result.data,
        warnings,
      }
    },

    /**
     * Check if containers exist in the system (batch check)
     */
    async checkExistence(containerNumbers: string[]): Promise<Map<string, boolean>> {
      const normalized = containerNumbers.map(normalizeContainerNumber)
      const result = await containerRepository.existsMany(normalized)
      if (!result.success) {
        throw new InfrastructureError(
          `Failed to check container existence: ${result.error?.message ?? 'Unknown error'}`,
          result.error ?? undefined,
        )
      }
      return result.data
    },

    /**
     * Find containers by numbers (batch fetch)
     */
    async findByNumbers(containerNumbers: string[]): Promise<Container[]> {
      const normalized = containerNumbers.map(normalizeContainerNumber)
      const result = await containerRepository.findByNumbers(normalized)
      if (!result.success) {
        throw new InfrastructureError(
          `Failed to find containers: ${result.error?.message ?? 'Unknown error'}`,
          result.error ?? undefined,
        )
      }
      return result.data
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
      added: Container[]
      removed: string[]
      warnings: string[]
    }> {
      const warnings: string[] = []
      const added: Container[] = []
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

        const newContainer: NewContainer = {
          process_id: processId,
          container_number: item.containerNumber,
          carrier_code: item.carrier_code,
        }

        const result = await containerRepository.insert(newContainer)
        if (!result.success) {
          throw new InfrastructureError(
            `Failed to add container ${item.containerNumber}: ${result.error?.message ?? 'Unknown error'}`,
            result.error ?? undefined,
          )
        }
        added.push(result.data)
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

        const delResult = await containerRepository.delete(container.id)
        if (!delResult.success) {
          throw new Error(
            `Failed to delete container ${container.id}: ${delResult.error?.message ?? 'Unknown error'}`,
            { cause: delResult.error ?? undefined },
          )
        }
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

      const delResult = await containerRepository.delete(containerId)
      if (!delResult.success) {
        throw new InfrastructureError(
          `Failed to delete container ${containerId}: ${delResult.error?.message ?? 'Unknown error'}`,
          delResult.error ?? undefined,
        )
      }
    },
  }
}
