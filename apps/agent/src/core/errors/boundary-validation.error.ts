export class BoundaryValidationError extends Error {
  readonly details: string

  constructor(message: string, details: string) {
    super(message)
    this.name = 'BoundaryValidationError'
    this.details = details
  }
}
