import type { Provider } from '~/modules/tracking/domain/model/provider'

type RefreshContainerRecord = {
  readonly id: string
}

type ContainerLookupPort = {
  findByNumbers(command: {
    readonly containerNumbers: readonly string[]
  }): Promise<{ readonly containers: readonly RefreshContainerRecord[] }>
}

type EnqueueSyncRequestPort = {
  enqueueSyncRequest(command: {
    readonly provider: Provider
    readonly refType: 'container'
    readonly refValue: string
    readonly priority: number
  }): Promise<{
    readonly id: string
    readonly status: 'PENDING' | 'LEASED'
    readonly isNew: boolean
  }>
}

export type RefreshRestContainerCommand = {
  readonly container: string
  readonly provider: Provider
}

export type RefreshRestContainerResult =
  | {
      readonly kind: 'container_not_found'
      readonly container: string
    }
  | {
      readonly kind: 'queued'
      readonly container: string
      readonly syncRequestId: string
      readonly queued: true
      readonly deduped: boolean
    }

export type RefreshRestContainerDeps = {
  readonly containerLookup: ContainerLookupPort
  readonly enqueueSyncRequest: EnqueueSyncRequestPort
}

export function createRefreshRestContainerUseCase(deps: RefreshRestContainerDeps) {
  return async function execute(
    command: RefreshRestContainerCommand,
  ): Promise<RefreshRestContainerResult> {
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

    const enqueueResult = await deps.enqueueSyncRequest.enqueueSyncRequest({
      provider: command.provider,
      refType: 'container',
      refValue: command.container,
      priority: 0,
    })

    return {
      kind: 'queued',
      container: command.container,
      syncRequestId: enqueueResult.id,
      queued: true,
      deduped: !enqueueResult.isNew,
    }
  }
}
