import type { ContainerEntity } from '~/modules/container/domain/container.entity'

/**
 * Error thrown when a container already exists in the system
 */
export class ContainerAlreadyExistsError extends Error {
  constructor(
    public readonly containerNumber: string,
    public readonly existingContainer: ContainerEntity | null = null,
  ) {
    super(`Container ${containerNumber.toUpperCase()} already exists in the system`)
    this.name = 'ContainerAlreadyExistsError'
  }
}

/**
 * Error thrown when trying to remove the last container from a process
 */
export class CannotRemoveLastContainerError extends Error {
  constructor(
    public readonly processId: string,
    public readonly containerId: string,
  ) {
    super('Cannot remove the last container from a process')
    this.name = 'CannotRemoveLastContainerError'
  }
}

/**
 * Error thrown when duplicate containers are found in input
 */
export class DuplicateContainersError extends Error {
  constructor(public readonly duplicates: readonly string[]) {
    super(`Duplicate container numbers in request: ${duplicates.join(', ')}`)
    this.name = 'DuplicateContainersError'
  }
}

/**
 * Resolve the owner of a container that already exists
 */
export async function resolveContainerOwner(
  containerNumber: string,
  fetchContainerByNumber: (containerNumber: string) => Promise<ContainerEntity | null>,
): Promise<{
  processId: string
  containerId: string
  containerNumber: string
  link: string
} | null> {
  try {
    const container = await fetchContainerByNumber(containerNumber)
    if (!container) return null

    return {
      processId: String(container.processId),
      containerId: String(container.id),
      containerNumber: String(container.containerNumber),
      link: `/shipments/${String(container.processId)}`,
    }
  } catch (err) {
    console.warn('Failed to resolve existing container owner:', err)
    return null
  }
}
