type ContainerLookupResult = {
  readonly id: string
  readonly processId: string
  readonly containerNumber: string
}

export type ContainerConflictDto = {
  readonly containerNumber: string
  readonly processId: string
  readonly containerId: string
  readonly link: string
  readonly message: string
}

export function toContainerConflictDto(
  containerNumber: string,
  existing: ContainerLookupResult,
): ContainerConflictDto {
  return {
    containerNumber,
    processId: existing.processId,
    containerId: existing.id,
    link: `/shipments/${existing.processId}`,
    message: `Container ${containerNumber} already exists in another process`,
  }
}
