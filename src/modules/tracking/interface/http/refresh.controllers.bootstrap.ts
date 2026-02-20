import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import {
  createRefreshMaerskContainerUseCase,
  type RefreshMaerskContainerDeps,
} from '~/modules/tracking/application/usecases/refresh-maersk-container.usecase'
import {
  createRefreshRestContainerUseCase,
  type RefreshRestContainerDeps,
} from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import { createMaerskCaptureService } from '~/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher'
import {
  createRefreshControllers,
  type RefreshControllers,
} from '~/modules/tracking/interface/http/refresh.controllers'

const { trackingUseCases } = bootstrapTrackingModule()

export type RefreshControllersBootstrapOverrides = Partial<{
  readonly refreshRestDeps: RefreshRestContainerDeps
  readonly refreshMaerskDeps: RefreshMaerskContainerDeps
}>

export function bootstrapRefreshControllers(
  overrides: RefreshControllersBootstrapOverrides = {},
): RefreshControllers {
  const refreshRestDeps: RefreshRestContainerDeps = overrides.refreshRestDeps ?? {
    containerLookup: containerUseCases,
    fetchAndProcess: trackingUseCases,
  }

  const refreshMaerskDeps: RefreshMaerskContainerDeps = overrides.refreshMaerskDeps ?? {
    maerskCaptureService: createMaerskCaptureService(),
    containerLookup: containerUseCases,
    saveAndProcess: trackingUseCases,
  }

  return createRefreshControllers({
    refreshRestUseCase: createRefreshRestContainerUseCase(refreshRestDeps),
    refreshMaerskUseCase: createRefreshMaerskContainerUseCase(refreshMaerskDeps),
  })
}
