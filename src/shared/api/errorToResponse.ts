import { TypedFetchError } from '~/shared/api/typedFetch'
import {
  CannotRemoveLastContainerError,
  ContainerAlreadyExistsError,
  DuplicateContainersError,
} from '~/shared/errors/container-process.errors'
import { HttpError, InfrastructureError } from '~/shared/errors/httpErrors'

function jsonResponse(body: unknown, status = 500): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function mapErrorToResponse(err: unknown): Response {
  // HttpError has explicit status
  if (err instanceof HttpError) {
    return jsonResponse({ error: err.message }, err.status)
  }

  // TypedFetchError carries HTTP status from remote fetch
  if (err instanceof TypedFetchError) {
    return jsonResponse({ error: err.message }, err.status)
  }

  // Domain-specific errors -> map to appropriate codes
  if (err instanceof ContainerAlreadyExistsError) {
    return jsonResponse({ error: err.message, existing: err.existing ?? null }, 409)
  }

  if (err instanceof DuplicateContainersError) {
    return jsonResponse({ error: err.message, duplicates: err.duplicates }, 400)
  }

  if (err instanceof CannotRemoveLastContainerError) {
    return jsonResponse({ error: err.message }, 400)
  }

  // InfrastructureError -> 500
  if (err instanceof InfrastructureError) {
    return jsonResponse({ error: err.message }, 500)
  }

  // Fallback: unknown error
  const msg = err instanceof Error ? err.message : String(err)
  return jsonResponse({ error: msg }, 500)
}
