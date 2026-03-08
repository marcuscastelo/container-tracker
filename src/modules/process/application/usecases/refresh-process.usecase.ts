import { HttpError } from '~/shared/errors/httpErrors'

type SupportedProvider = 'msc' | 'maersk' | 'cmacgm'

type RefreshMode = 'process' | 'container'

type RefreshProcessContainerRecord = {
  readonly containerNumber: string
  readonly carrierCode: string | null
}

type RefreshQueuedRequest = {
  readonly containerNumber: string
  readonly syncRequestId: string
  readonly deduped: boolean
}

type RefreshFailure = {
  readonly containerNumber: string
  readonly error: string
}

type RefreshProcessCommand = {
  readonly processId: string
  readonly mode: RefreshMode
  readonly containerNumber?: string
}

export type RefreshProcessResult = {
  readonly processId: string
  readonly mode: RefreshMode
  readonly requestedContainers: number
  readonly queuedContainers: number
  readonly syncRequestIds: readonly string[]
  readonly requests: readonly RefreshQueuedRequest[]
  readonly failures: readonly RefreshFailure[]
}

export type RefreshProcessDeps = {
  readonly fetchProcessById: (command: {
    readonly processId: string
  }) => Promise<{ readonly id: string } | null>
  readonly listContainersByProcessId: (command: { readonly processId: string }) => Promise<{
    readonly containers: readonly RefreshProcessContainerRecord[]
  }>
  readonly enqueueContainerSyncRequest: (command: {
    readonly provider: SupportedProvider
    readonly containerNumber: string
  }) => Promise<{
    readonly id: string
    readonly status: 'PENDING' | 'LEASED'
    readonly isNew: boolean
  }>
}

const PROVIDER_BY_CARRIER: Readonly<Record<string, SupportedProvider>> = {
  msc: 'msc',
  maersk: 'maersk',
  cmacgm: 'cmacgm',
}

function normalizeCarrierCode(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]/g, '')
}

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function toSupportedProvider(carrierCode: string | null): SupportedProvider | null {
  if (!carrierCode) return null
  const normalizedCarrierCode = normalizeCarrierCode(carrierCode)
  return PROVIDER_BY_CARRIER[normalizedCarrierCode] ?? null
}

export function createRefreshProcessUseCase(deps: RefreshProcessDeps) {
  return async function execute(command: RefreshProcessCommand): Promise<RefreshProcessResult> {
    const processId = command.processId.trim()
    if (processId.length === 0) {
      throw new HttpError('process_id_required_for_refresh', 400)
    }

    const process = await deps.fetchProcessById({ processId })
    if (!process) {
      throw new HttpError('process_not_found', 404)
    }

    const { containers } = await deps.listContainersByProcessId({ processId })
    const containersByNumber = new Map(
      containers.map((container) => [
        normalizeContainerNumber(container.containerNumber),
        container,
      ]),
    )

    let targetContainers: readonly RefreshProcessContainerRecord[] = containers
    if (command.mode === 'container') {
      const targetContainerNumber = normalizeContainerNumber(command.containerNumber ?? '')
      if (targetContainerNumber.length === 0) {
        throw new HttpError('container_number_required_for_refresh_mode_container', 400)
      }

      const container = containersByNumber.get(targetContainerNumber)
      if (!container) {
        throw new HttpError('container_not_found_in_process', 404)
      }
      targetContainers = [container]
    }

    const requests: RefreshQueuedRequest[] = []
    const failures: RefreshFailure[] = []

    for (const targetContainer of targetContainers) {
      const containerNumber = normalizeContainerNumber(targetContainer.containerNumber)
      if (containerNumber.length === 0) {
        failures.push({
          containerNumber,
          error: 'invalid_container_number_for_refresh',
        })
        continue
      }

      const provider = toSupportedProvider(targetContainer.carrierCode)
      if (provider === null) {
        failures.push({
          containerNumber,
          error: 'unsupported_sync_provider_for_container',
        })
        continue
      }

      try {
        const enqueueResult = await deps.enqueueContainerSyncRequest({
          provider,
          containerNumber,
        })

        requests.push({
          containerNumber,
          syncRequestId: enqueueResult.id,
          deduped: !enqueueResult.isNew,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.length > 0 ? error.message : 'enqueue_failed'

        failures.push({
          containerNumber,
          error: errorMessage,
        })
      }
    }

    return {
      processId,
      mode: command.mode,
      requestedContainers: targetContainers.length,
      queuedContainers: requests.length,
      syncRequestIds: Array.from(new Set(requests.map((request) => request.syncRequestId))),
      requests,
      failures,
    }
  }
}
