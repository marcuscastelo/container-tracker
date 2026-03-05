type ExistingContainerConflict = {
  readonly processId: string
  readonly containerId: string
  readonly containerNumber: string
  readonly link: string
}

/**
 * Error thrown when a container already exists in another process.
 */
export class ContainerAlreadyExistsError extends Error {
  constructor(
    public readonly containerNumber: string,
    public readonly existing: ExistingContainerConflict | null = null,
  ) {
    super(`Container ${containerNumber.toUpperCase()} already exists in another process`)
    this.name = 'ContainerAlreadyExistsError'
  }
}

/**
 * Error thrown when trying to remove the last container from a process.
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
 * Error thrown when duplicate containers are found in input.
 */
export class DuplicateContainersError extends Error {
  constructor(public readonly duplicates: readonly string[]) {
    super(`Duplicate container numbers in request: ${duplicates.join(', ')}`)
    this.name = 'DuplicateContainersError'
  }
}
