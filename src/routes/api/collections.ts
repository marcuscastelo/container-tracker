// API route: return container statuses from Supabase as a simple array
// This handler runs on the server and fetches from the `container-status` table.
import { containerStatusUseCases } from '~/modules/container'

async function handle() {
  try {
    console.log('api/collections: fetching container statuses from Supabase')
    const statuses = await containerStatusUseCases.getAllContainerStatuses()

    // Transform to the expected format for the collections loader
    const samples = statuses.map((s) => ({
      container_id: s.container_id,
      status: s.status,
    }))

    console.log(`api/collections: fetched ${samples.length} container statuses`)
    return new Response(JSON.stringify(samples), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('api/collections GET error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}

export async function GET() {
  return handle()
}

export async function POST() {
  return handle()
}
