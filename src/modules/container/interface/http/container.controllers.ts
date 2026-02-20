import type { ContainerUseCases } from '~/modules/container/application/container.usecases'
import { toContainerConflictDto } from '~/modules/container/interface/http/container.http.mappers'
import {
  CheckContainersBodySchema,
  CheckContainersResponseSchema,
} from '~/modules/container/interface/http/container.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse, parseBody } from '~/shared/api/typedRoute'

export type ContainerControllerDeps = {
  readonly containerUseCases: Pick<ContainerUseCases, 'findByNumbers'>
}

export function createContainerControllers(deps: ContainerControllerDeps) {
  async function checkContainers({ request }: { request: Request }): Promise<Response> {
    try {
      const parsed = await parseBody(request, CheckContainersBodySchema)
      const normalized = parsed.containers.map((container) => container.toUpperCase().trim())

      const { containers } = await deps.containerUseCases.findByNumbers({
        containerNumbers: normalized,
      })

      const byNumber = new Map(
        containers.map((container) => [
          String(container.containerNumber),
          {
            id: String(container.id),
            processId: String(container.processId),
            containerNumber: String(container.containerNumber),
          },
        ]),
      )

      const conflicts = normalized
        .map((containerNumber) => {
          const existing = byNumber.get(containerNumber)
          if (!existing) return null
          return toContainerConflictDto(containerNumber, existing)
        })
        .filter((conflict): conflict is NonNullable<typeof conflict> => conflict !== null)

      return jsonResponse({ conflicts }, 200, CheckContainersResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return { checkContainers }
}

export type ContainerControllers = ReturnType<typeof createContainerControllers>
