import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import {
  type ContainerControllers,
  createContainerControllers,
} from '~/modules/container/interface/http/container.controllers'

export type ContainerControllersBootstrapOverrides = Partial<{
  readonly containerUseCases: typeof containerUseCases
}>

export function bootstrapContainerControllers(
  overrides: ContainerControllersBootstrapOverrides = {},
): ContainerControllers {
  return createContainerControllers({
    containerUseCases: overrides.containerUseCases ?? containerUseCases,
  })
}
