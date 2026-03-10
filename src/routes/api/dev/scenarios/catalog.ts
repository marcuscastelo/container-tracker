import z from 'zod/v4'

import { scenarioSeeder } from '~/modules/tracking/dev/scenario-lab/scenario.seed.bootstrap'
import { jsonResponse } from '~/shared/api/typedRoute'
import { serverEnv } from '~/shared/config/server-env'

export const runtime = 'nodejs'

const CatalogResponseSchema = z.object({
  stages: z.array(
    z.object({
      stage: z.number().int().min(0).max(10),
      label: z.string(),
      title: z.string(),
    }),
  ),
  groups: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      stage: z.number().int().min(0).max(10).nullable(),
      scenarioIds: z.array(z.string()),
    }),
  ),
  scenarios: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      category: z.enum(['lifecycle', 'data_pathologies', 'process_aggregation']),
      stage: z.number().int().min(0).max(10),
      tags: z.array(z.string()),
      stepsCount: z.number().int().min(1),
      containersCount: z.number().int().min(1),
    }),
  ),
})

function isScenarioLabEnabled(): boolean {
  return serverEnv.NODE_ENV?.toLowerCase() !== 'production'
}

export async function GET(): Promise<Response> {
  if (!isScenarioLabEnabled()) {
    return jsonResponse({ error: 'Not found' }, 404)
  }

  const catalog = scenarioSeeder.getCatalog()
  CatalogResponseSchema.parse(catalog)
  return jsonResponse(catalog, 200)
}
