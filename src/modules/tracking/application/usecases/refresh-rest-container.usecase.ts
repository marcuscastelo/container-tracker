import type { Provider } from '~/modules/tracking/domain/model/provider'
import { HttpError } from '~/shared/errors/httpErrors'

type RefreshContainerRecord = {
  readonly id: string
  readonly containerNumber: string
  readonly carrierCode: string | null
  readonly processId: string
}

type RefreshContainerProcessRecord = {
  readonly id: string
  readonly carrier: string | null
}

type ContainerLookupPort = {
  findByNumbers(command: {
    readonly containerNumbers: readonly string[]
  }): Promise<{ readonly containers: readonly RefreshContainerRecord[] }>
}

type ProcessLookupPort = {
  findProcessById(command: {
    readonly processId: string
  }): Promise<{ readonly process: RefreshContainerProcessRecord | null }>
}

type ContainerCarrierMutationPort = {
  updateContainerCarrier(command: {
    readonly containerId: string
    readonly containerNumber: string
    readonly carrierCode: string
  }): Promise<void>
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
  readonly processLookup: ProcessLookupPort
  readonly containerCarrierMutation: ContainerCarrierMutationPort
  readonly enqueueSyncRequest: EnqueueSyncRequestPort
}

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function normalizeCarrierCode(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]/g, '')
}

export function createRefreshRestContainerUseCase(deps: RefreshRestContainerDeps) {
  return async function execute(
    command: RefreshRestContainerCommand,
  ): Promise<RefreshRestContainerResult> {
    const normalizedContainerNumber = normalizeContainerNumber(command.container)
    const lookup = await deps.containerLookup.findByNumbers({
      containerNumbers: [normalizedContainerNumber],
    })

    const exactNumberMatches = lookup.containers.filter((container) => {
      return normalizeContainerNumber(container.containerNumber) === normalizedContainerNumber
    })

    if (exactNumberMatches.length === 0) {
      return {
        kind: 'container_not_found',
        container: normalizedContainerNumber,
      }
    }

    const matchingContainers = exactNumberMatches.filter((container) => {
      return normalizeCarrierCode(container.carrierCode) === normalizeCarrierCode(command.provider)
    })

    if (matchingContainers.length === 0) {
      if (exactNumberMatches.length === 1) {
        const staleContainer = exactNumberMatches[0]
        if (staleContainer !== undefined) {
          const ownerProcess = await deps.processLookup.findProcessById({
            processId: staleContainer.processId,
          })

          if (
            ownerProcess.process !== null &&
            normalizeCarrierCode(ownerProcess.process.carrier) ===
              normalizeCarrierCode(command.provider)
          ) {
            await deps.containerCarrierMutation.updateContainerCarrier({
              containerId: staleContainer.id,
              containerNumber: staleContainer.containerNumber,
              carrierCode: command.provider,
            })

            matchingContainers.push({
              ...staleContainer,
              carrierCode: command.provider,
            })
          }
        }
      }
    }

    if (matchingContainers.length === 0) {
      throw new HttpError(
        `container_provider_mismatch_for_refresh:${normalizedContainerNumber}:${command.provider}`,
        409,
      )
    }

    if (matchingContainers.length > 1) {
      throw new HttpError(
        `ambiguous_container_provider_for_refresh:${normalizedContainerNumber}:${command.provider}`,
        409,
      )
    }

    const enqueueResult = await deps.enqueueSyncRequest.enqueueSyncRequest({
      provider: command.provider,
      refType: 'container',
      refValue: normalizedContainerNumber,
      priority: 0,
    })

    return {
      kind: 'queued',
      container: normalizedContainerNumber,
      syncRequestId: enqueueResult.id,
      queued: true,
      deduped: !enqueueResult.isNew,
    }
  }
}
