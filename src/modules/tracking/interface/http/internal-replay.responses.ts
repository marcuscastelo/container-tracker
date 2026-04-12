import { ReplayEnabledResponseSchema } from '~/modules/tracking/interface/http/internal-replay.schemas'
import { jsonResponse } from '~/shared/api/typedRoute'

export function internalReplayNotFoundResponse(): Response {
  return jsonResponse({ error: 'Not found' }, 404)
}

export function internalReplayEnabledResponse(): Response {
  return jsonResponse({ enabled: true }, 200, ReplayEnabledResponseSchema)
}
