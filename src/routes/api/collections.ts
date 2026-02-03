// API route: return container statuses from Supabase as a simple array
// This handler runs on the server and fetches from the `container-status` table.
import { containerStatusUseCases } from '~/modules/container'
import { z } from 'zod/v4'

// Explicit Zod schemas for request/response types
export const CollectionsRequestSchema = z.object({}).strict()

export const CollectionsItemSchema = z.object({
  container_id: z.string(),
  carrier: z.string().nullable(),
  // status is stored as JSON in Supabase (JSONB) and can be any record
  status: z.record(z.unknown()).nullable(),
})

export const CollectionsResponseSchema = z.array(CollectionsItemSchema)

export const ApiErrorResponseSchema = z.object({ error: z.string() })

export type CollectionsRequest = z.infer<typeof CollectionsRequestSchema>
export type CollectionsResponse = z.infer<typeof CollectionsResponseSchema>
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>

async function handle() {
  try {
    console.log('api/collections: fetching container statuses from Supabase')
    const statuses = await containerStatusUseCases.getAllContainerStatuses()

    // Transform to the expected format for the collections loader
    const samples = statuses.map((s) => ({
      container_id: s.container_id,
      carrier: s.carrier,
      status: s.status,
    }))

    console.log(`api/collections: fetched ${samples.length} container statuses`)
    // Build schema inline to avoid possible circular initialization issues
    const successSchema = z.array(z.object({ container_id: z.string(), carrier: z.string().nullable(), status: z.string().nullable() }))
    return respondWithSchema(samples, successSchema, 200)
  } catch (err: any) {
    console.error('api/collections GET error', err)
    const errSchema = z.object({ error: z.string() })
    return respondWithSchema({ error: String(err) }, errSchema, 500)
  }
}

export async function GET() {
  return handle()
}

export async function POST() {
  return handle()
}

// Helper to validate payloads against schemas and return Response
function respondWithSchema<T>(payload: T, schema: z.ZodTypeAny, status = 200) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.error('collections: response validation failed', parsed.error.format())
    return new Response(JSON.stringify({ error: 'response validation failed' }), { status: 500 })
  }
  return new Response(JSON.stringify(parsed.data), { status, headers: { 'Content-Type': 'application/json' } })
}
