export class ProcessAlreadyExistsError extends Error {
  constructor(reference: string) {
    super(`Process with reference "${reference}" already exists`)
  }
}

export class ContainerAlreadyExistsInAnotherProcessError extends Error {
  constructor(public readonly containerNumber: string) {
    super(`Container ${containerNumber} already belongs to another process`)
  }
}

export class InvalidProcessStateError extends Error {
  constructor(message: string) {
    super(message)
  }
}
