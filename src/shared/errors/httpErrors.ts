export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request') {
    super(message, 400)
    this.name = 'BadRequestError'
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(message, 409)
    this.name = 'ConflictError'
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
