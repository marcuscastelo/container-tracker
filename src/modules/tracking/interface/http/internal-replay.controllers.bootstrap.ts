import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import {
  createInternalReplayControllers,
  type InternalReplayControllers,
} from '~/modules/tracking/interface/http/internal-replay.controllers'
import { serverEnv } from '~/shared/config/server-env'

function resolveCodeVersion(): string | null {
  const codeVersion = process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  if (typeof codeVersion !== 'string') {
    return null
  }

  const normalized = codeVersion.trim()
  return normalized.length > 0 ? normalized : null
}

export function bootstrapInternalReplayControllers(): InternalReplayControllers {
  const { trackingUseCases } = bootstrapTrackingModule()

  return createInternalReplayControllers({
    trackingUseCases,
    isEnabled: () => serverEnv.ENABLE_INTERNAL_TRACKING_REPLAY_UI,
    resolveCodeVersion,
  })
}
