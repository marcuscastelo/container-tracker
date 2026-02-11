import { z } from 'zod'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse, parseBody } from '~/shared/api/typedRoute'

const BodySchema = z.object({
  containers: z.array(z.string()).nonempty(),
})

export async function POST({ request }: { request: Request }): Promise<Response> {
  try {
    const parsed = await parseBody(request, BodySchema)
    const normalized = parsed.containers.map((c) => c.toUpperCase().trim())

    const { containers } = await containerUseCases.findByNumbers({ containerNumbers: normalized })

    const byNumber = new Map(containers.map((c) => [String(c.containerNumber), c]))

    const conflicts = normalized
      .map((containerNumber) => {
        const existing = byNumber.get(containerNumber)
        if (!existing) return null
        return {
          containerNumber,
          processId: String(existing.processId),
          containerId: String(existing.id),
          link: `/shipments/${String(existing.processId)}`,
          message: `Container ${containerNumber} already exists in another process`,
        }
      })
      .filter(Boolean)

    return jsonResponse({ conflicts })
  } catch (err) {
    console.error('POST /api/processes/check error:', err)
    return mapErrorToResponse(err)
  }
}

export { BodySchema }
