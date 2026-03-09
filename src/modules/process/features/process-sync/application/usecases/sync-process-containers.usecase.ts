import { HttpError } from '~/shared/errors/httpErrors'

const DEFAULT_SYNC_TIMEOUT_MS = 180_000
const DEFAULT_SYNC_POLL_INTERVAL_MS = 5_000

type SupportedProvider = 'msc' | 'maersk' | 'cmacgm'

type SyncRequestStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'

type SyncStatusItem = {
  readonly syncRequestId: string
  readonly status: SyncRequestStatus
  readonly lastError: string | null
}

type SyncTarget = {
  readonly containerNumber: string
  readonly provider: SupportedProvider
}

type SyncProcessContainerRecord = {
  readonly containerNumber: string
  readonly carrierCode: string | null
}

type SyncProcessContainersResult = {
  readonly processId: string
  readonly syncedContainers: number
}

type SyncProcessContainersCommand = {
  readonly processId: string
}

export type SyncProcessContainersDeps = {
  readonly fetchProcessById: (command: {
    readonly processId: string
  }) => Promise<{ readonly id: string } | null>
  readonly listContainersByProcessId: (command: { readonly processId: string }) => Promise<{
    readonly containers: readonly SyncProcessContainerRecord[]
  }>
  readonly enqueueContainerSyncRequest: (command: {
    readonly provider: SupportedProvider
    readonly containerNumber: string
  }) => Promise<{
    readonly id: string
    readonly status: 'PENDING' | 'LEASED'
    readonly isNew: boolean
  }>
  readonly getSyncRequestStatuses: (command: {
    readonly syncRequestIds: readonly string[]
  }) => Promise<{
    readonly allTerminal: boolean
    readonly requests: readonly SyncStatusItem[]
  }>
  readonly nowMs?: () => number
  readonly sleep?: (delayMs: number) => Promise<void>
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
}

const PROVIDER_BY_CARRIER: Record<string, SupportedProvider> = {
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
  return value.toUpperCase().trim()
}

function toSupportedProvider(carrierCode: string | null): SupportedProvider | null {
  if (!carrierCode) return null
  const normalized = normalizeCarrierCode(carrierCode)
  return PROVIDER_BY_CARRIER[normalized] ?? null
}

function isTerminalStatus(status: SyncRequestStatus): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'NOT_FOUND'
}

function toTerminalStatusItems(
  syncRequestIds: readonly string[],
  requests: readonly SyncStatusItem[],
): readonly SyncStatusItem[] {
  const byId = new Map(requests.map((request) => [request.syncRequestId, request]))

  return syncRequestIds.map((syncRequestId) => {
    const request = byId.get(syncRequestId)
    if (request) return request

    return {
      syncRequestId,
      status: 'NOT_FOUND',
      lastError: 'sync_request_not_found',
    }
  })
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

async function waitForTerminalStatuses(command: {
  readonly syncRequestIds: readonly string[]
  readonly timeoutMs: number
  readonly pollIntervalMs: number
  readonly getSyncRequestStatuses: SyncProcessContainersDeps['getSyncRequestStatuses']
  readonly nowMs: () => number
  readonly sleep: (delayMs: number) => Promise<void>
}): Promise<readonly SyncStatusItem[]> {
  let lastProgressAtMs = command.nowMs()
  let highestDoneCount = 0

  while (true) {
    const response = await command.getSyncRequestStatuses({
      syncRequestIds: command.syncRequestIds,
    })

    const requests = toTerminalStatusItems(command.syncRequestIds, response.requests)
    const doneCount = requests.filter((request) => request.status === 'DONE').length
    if (doneCount > highestDoneCount) {
      highestDoneCount = doneCount
      lastProgressAtMs = command.nowMs()
    }

    if (requests.every((request) => isTerminalStatus(request.status))) {
      return requests
    }

    const nowMs = command.nowMs()
    const idleMs = nowMs - lastProgressAtMs
    if (idleMs >= command.timeoutMs) {
      break
    }

    const remainingMs = command.timeoutMs - idleMs
    await command.sleep(Math.min(command.pollIntervalMs, remainingMs))
  }

  throw new HttpError('sync_process_timeout', 504)
}

export function createSyncProcessContainersUseCase(deps: SyncProcessContainersDeps) {
  const nowMs = deps.nowMs ?? Date.now
  const sleep = deps.sleep ?? defaultSleep
  const timeoutMs = deps.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS

  return async function execute(
    command: SyncProcessContainersCommand,
  ): Promise<SyncProcessContainersResult> {
    const processId = command.processId.trim()
    if (processId.length === 0) {
      throw new HttpError('process_id_required_for_sync', 400)
    }

    const process = await deps.fetchProcessById({ processId })
    if (!process) {
      throw new HttpError('process_not_found', 404)
    }

    const { containers } = await deps.listContainersByProcessId({ processId })
    if (containers.length === 0) {
      return {
        processId,
        syncedContainers: 0,
      }
    }

    const syncTargets: SyncTarget[] = []

    for (const container of containers) {
      const provider = toSupportedProvider(container.carrierCode)
      if (provider === null) {
        const containerNumber = normalizeContainerNumber(container.containerNumber)
        const carrierCode = container.carrierCode ?? 'null'
        throw new HttpError(
          `unsupported_sync_provider_for_process:${processId}:${containerNumber}:${carrierCode}`,
          422,
        )
      }

      const containerNumber = normalizeContainerNumber(container.containerNumber)
      if (containerNumber.length === 0) {
        throw new HttpError('invalid_container_number_for_sync', 422)
      }

      syncTargets.push({
        containerNumber,
        provider,
      })
    }

    const enqueueResults = await Promise.all(
      syncTargets.map((target) =>
        deps.enqueueContainerSyncRequest({
          provider: target.provider,
          containerNumber: target.containerNumber,
        }),
      ),
    )

    const syncRequestIds = Array.from(new Set(enqueueResults.map((result) => result.id)))
    const requests = await waitForTerminalStatuses({
      syncRequestIds,
      timeoutMs,
      pollIntervalMs,
      getSyncRequestStatuses: deps.getSyncRequestStatuses,
      nowMs,
      sleep,
    })

    const failures = requests.filter((request) => {
      return request.status === 'FAILED' || request.status === 'NOT_FOUND'
    })

    if (failures.length > 0) {
      const firstFailure = failures[0]
      const firstError =
        firstFailure.lastError ??
        `${firstFailure.status.toLowerCase()}_${firstFailure.syncRequestId}`
      throw new HttpError(`sync_process_failed:${processId}:${firstError}`, 502)
    }

    return {
      processId,
      syncedContainers: syncTargets.length,
    }
  }
}
