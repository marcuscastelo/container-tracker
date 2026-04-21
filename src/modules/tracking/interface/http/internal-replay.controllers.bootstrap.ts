import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import {
  createInternalReplayControllers,
  type InternalReplayControllers,
} from '~/modules/tracking/interface/http/internal-replay.controllers'
import { serverEnv } from '~/shared/config/server-env'

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

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
  const replayAuthToken = serverEnv.INTERNAL_TRACKING_REPLAY_TOKEN

  return createInternalReplayControllers({
    trackingUseCases,
    isEnabled: () => serverEnv.ENABLE_INTERNAL_TRACKING_REPLAY_UI && replayAuthToken !== null,
    authenticateRequest: (request) => {
      if (replayAuthToken === null) {
        return false
      }

      return getBearerToken(request.headers.get('authorization')) === replayAuthToken
    },
    resolveCodeVersion,
  })
}
