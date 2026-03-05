export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class InfrastructureError extends HttpError {
  constructor(
    message = 'Internal server error',
    public readonly cause?: unknown,
  ) {
    super(message, 500)
    this.name = 'InfrastructureError'
  }
}
