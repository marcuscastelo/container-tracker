import type { Provider } from '~/modules/tracking/domain/model/provider'

type RefreshContainerRecord = {
  readonly id: string
}

type ContainerLookupPort = {
  findByNumbers(command: {
    readonly containerNumbers: readonly string[]
  }): Promise<{ readonly containers: readonly RefreshContainerRecord[] }>
}

type FetchAndProcessPort = {
  fetchAndProcess(
    containerId: string,
    containerNumber: string,
    provider: Provider,
  ): Promise<{
    readonly snapshot: { readonly id: string }
    readonly pipeline: {
      readonly newObservations: readonly unknown[]
      readonly newAlerts: readonly unknown[]
      readonly status: string
    }
  } | null>
}

export type RefreshRestContainerCommand = {
  readonly container: string
  readonly provider: Provider
}

export type RefreshRestContainerResult =
  | {
      readonly kind: 'redirect'
      readonly redirectPath: string
    }
  | {
      readonly kind: 'container_not_found'
      readonly container: string
    }
  | {
      readonly kind: 'no_rest_fetcher'
      readonly provider: Provider
    }
  | {
      readonly kind: 'ok'
      readonly container: string
      readonly snapshotId: string
      readonly status: string
      readonly newObservationsCount: number
      readonly newAlertsCount: number
    }

export type RefreshRestContainerDeps = {
  readonly containerLookup: ContainerLookupPort
  readonly fetchAndProcess: FetchAndProcessPort
}

export function createRefreshRestContainerUseCase(deps: RefreshRestContainerDeps) {
  return async function execute(
    command: RefreshRestContainerCommand,
  ): Promise<RefreshRestContainerResult> {
    if (command.provider === 'maersk') {
      return {
        kind: 'redirect',
        redirectPath: `/api/refresh-maersk/${encodeURIComponent(command.container)}`,
      }
    }

    const lookup = await deps.containerLookup.findByNumbers({
      containerNumbers: [command.container],
    })

    const container = lookup.containers[0]
    if (!container) {
      return {
        kind: 'container_not_found',
        container: command.container,
      }
    }

    const result = await deps.fetchAndProcess.fetchAndProcess(
      container.id,
      command.container,
      command.provider,
    )

    if (!result) {
      return {
        kind: 'no_rest_fetcher',
        provider: command.provider,
      }
    }

    return {
      kind: 'ok',
      container: command.container,
      snapshotId: result.snapshot.id,
      status: result.pipeline.status,
      newObservationsCount: result.pipeline.newObservations.length,
      newAlertsCount: result.pipeline.newAlerts.length,
    }
  }
}
