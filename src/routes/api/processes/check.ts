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

    const conflicts: {
      containerNumber: string
      processId?: string
      containerId?: string
      link?: string
      message?: string
    }[] = []

    for (const c of parsed.containers) {
      const normalized = c.toUpperCase().trim()
      try {
        const container = await containerUseCases
          .findByNumbers({
            containerNumbers: [normalized],
          })
          .then((result) => result.containers[0] ?? null)
        if (container) {
          conflicts.push({
            containerNumber: normalized,
            processId: String(container.processId),
            containerId: String(container.id),
            link: `/shipments/${String(container.processId)}`,
            message: `Container ${normalized} already exists in another process`,
          })
        }
      } catch (err) {
        console.warn('check containers: failed to check', normalized, err)
        // on error, include a generic entry so UI can show something
        conflicts.push({ containerNumber: normalized, message: 'Failed to check container' })
      }
    }

    return jsonResponse({ conflicts })
  } catch (err) {
    console.error('POST /api/processes/check error:', err)
    return mapErrorToResponse(err)
  }
}

export { BodySchema }
