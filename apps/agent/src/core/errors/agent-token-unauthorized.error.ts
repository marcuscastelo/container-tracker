export class AgentTokenUnauthorizedError extends Error {
  readonly status: 401

  constructor(message: string) {
    super(message)
    this.name = 'AgentTokenUnauthorizedError'
    this.status = 401
  }
}

export function isAgentTokenUnauthorizedError(
  error: unknown,
): error is AgentTokenUnauthorizedError {
  return error instanceof AgentTokenUnauthorizedError
}
