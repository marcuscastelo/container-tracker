import z from 'zod/v4'

import { scenarioSeeder } from '~/modules/tracking/dev/scenario-lab/scenario.seed.bootstrap'
import { jsonResponse } from '~/shared/api/typedRoute'
import { serverEnv } from '~/shared/config/server-env'

export const runtime = 'nodejs'

const LoadScenarioBodySchema = z.object({
  scenario_id: z.string().min(1),
  step: z.coerce.number().int().min(1).default(1),
})

const LoadScenarioResponseSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    scenarioId: z.string(),
    appliedStep: z.number().int().min(1),
    processId: z.string(),
    processReference: z.string(),
    stage: z.number().int().min(0).max(10),
    containerIds: z.array(z.string()),
    containerNumbers: z.array(z.string()),
    totalSnapshotsApplied: z.number().int().min(0),
  }),
})

function isScenarioLabEnabled(): boolean {
  const nodeEnv = serverEnv.NODE_ENV?.toLowerCase()
  // Allow explicit opt-in via env flag or only enable in local development
  return serverEnv.SCENARIO_LAB_ENABLED === true || nodeEnv === 'development'
}

export async function POST({ request }: { request: Request }): Promise<Response> {
  if (!isScenarioLabEnabled()) {
    return jsonResponse({ error: 'Not found' }, 404)
  }

  const rawBody: unknown = await request.json().catch(() => ({}))
  const parsed = LoadScenarioBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
  }

  try {
    const result = await scenarioSeeder.loadScenario({
      scenarioId: parsed.data.scenario_id,
      step: parsed.data.step,
    })

    const payload = { ok: true, result }
    LoadScenarioResponseSchema.parse(payload)
    return jsonResponse(payload, 200)
  } catch (error) {
    // Treat schema mismatches and unexpected errors as server errors to avoid
    // leaking internal validation details as 4xx client errors.
    if (error instanceof z.ZodError) {
      console.error('Failed to validate load scenario response', error)
      return jsonResponse({ error: 'Failed to load scenario' }, 500)
    }

    const message = error instanceof Error ? error.message : 'Failed to load scenario'

    if (message.startsWith('Scenario not found')) {
      return jsonResponse({ error: message }, 404)
    }

    console.error('Unexpected error while loading scenario', error)
    return jsonResponse({ error: 'Failed to load scenario' }, 500)
  }
}
