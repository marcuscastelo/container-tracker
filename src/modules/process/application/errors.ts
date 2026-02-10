import type { ProcessContainer } from '~/modules/process/domain/processStuff'

/**
 * Error thrown when a container already exists in the system
 */
export class ContainerAlreadyExistsError extends Error {
  constructor(
    public readonly containerNumber: string,
    public readonly existingContainer: ProcessContainer | null = null,
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
 * Parse error message to detect container already exists errors
 */
export function parseContainerExistsError(message: string): {
  containerNumber: string | null
  isExistsError: boolean
} {
  const match = message.match(/Container\s+([A-Za-z0-9]+)\s+already exists/i)
  if (match) {
    return { containerNumber: match[1], isExistsError: true }
  }
  return { containerNumber: null, isExistsError: false }
}

/**
 * Resolve the owner of a container that already exists
 */
export async function resolveContainerOwner(
  containerNumber: string,
  fetchContainerByNumber: (containerNumber: string) => Promise<ProcessContainer | null>,
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
      processId: container.process_id,
      containerId: container.id,
      containerNumber: container.container_number,
      link: `/shipments/${container.process_id}`,
    }
  } catch (err) {
    console.warn('Failed to resolve existing container owner:', err)
    return null
  }
}
