import { bootstrapInternalReplayControllers } from '~/modules/tracking/interface/http/internal-replay.controllers.bootstrap'

export const runtime = 'nodejs'

const controllers = bootstrapInternalReplayControllers()

export const GET = controllers.enabled
