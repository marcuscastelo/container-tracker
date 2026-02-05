import { z } from 'zod'
import { supabaseProcessRepository } from '~/modules/process'

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const BodySchema = z.object({
  containers: z.array(z.string()).nonempty(),
})

export async function POST({ request }: { request: Request }): Promise<Response> {
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(raw)
    if (!parsed.success) {
      return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    const conflicts: {
      containerNumber: string
      processId?: string
      containerId?: string
      link?: string
      message?: string
    }[] = []

    for (const c of parsed.data.containers) {
      const normalized = c.toUpperCase().trim()
      try {
        const container = await supabaseProcessRepository.fetchContainerByNumber(normalized)
        if (container) {
          conflicts.push({
            containerNumber: normalized,
            processId: container.process_id,
            containerId: container.id,
            link: `/shipments/${container.process_id}`,
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
    return jsonResponse({ error: String(err) }, 500)
  }
}

export { BodySchema }
