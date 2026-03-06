import type { ProcessContainerRecord } from '~/modules/process/application/process.readmodels'
import { HttpError } from '~/shared/errors/httpErrors'

const DEFAULT_SYNC_TIMEOUT_MS = 180_000
const DEFAULT_SYNC_POLL_INTERVAL_MS = 5_000

type SupportedProvider = 'msc' | 'maersk' | 'cmacgm'

type SyncRequestStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'

type SyncStatusItem = {
  readonly syncRequestId: string
  readonly status: SyncRequestStatus
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

type SyncAllProcessesResult = {
  readonly syncedProcesses: number
  readonly syncedContainers: number
}

export type SyncAllProcessesDeps = {
  readonly listActiveProcessIds: () => Promise<readonly string[]>
  readonly listContainersByProcessIds: (command: {
    readonly processIds: readonly string[]
  }) => Promise<{
    readonly containersByProcessId: ReadonlyMap<string, readonly ProcessContainerRecord[]>
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

type SyncTarget = {
  readonly processId: string
  readonly containerNumber: string
  readonly provider: SupportedProvider
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

function toSupportedProvider(carrierCode: string | null): SupportedProvider | null {
  if (!carrierCode) return null
  const normalized = normalizeCarrierCode(carrierCode)
  return PROVIDER_BY_CARRIER[normalized] ?? null
}

function normalizeContainerNumber(value: string): string {
  return value.toUpperCase().trim()
}

function isTerminalStatus(status: SyncRequestStatus): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'NOT_FOUND'
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
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
      updatedAt: null,
      refValue: null,
    }
  })
}

async function waitForTerminalStatuses(command: {
  readonly syncRequestIds: readonly string[]
  readonly timeoutMs: number
  readonly pollIntervalMs: number
  readonly getSyncRequestStatuses: SyncAllProcessesDeps['getSyncRequestStatuses']
  readonly nowMs: () => number
  readonly sleep: (delayMs: number) => Promise<void>
}): Promise<readonly SyncStatusItem[]> {
  const deadlineMs = command.nowMs() + command.timeoutMs

  while (true) {
    const response = await command.getSyncRequestStatuses({
      syncRequestIds: command.syncRequestIds,
    })

    const requests = toTerminalStatusItems(command.syncRequestIds, response.requests)
    if (requests.every((request) => isTerminalStatus(request.status))) {
      return requests
    }

    const remainingMs = deadlineMs - command.nowMs()
    if (remainingMs <= 0) {
      break
    }

    await command.sleep(Math.min(command.pollIntervalMs, remainingMs))
  }

  throw new HttpError('sync_global_timeout', 504)
}

export function createSyncAllProcessesUseCase(deps: SyncAllProcessesDeps) {
  const nowMs = deps.nowMs ?? Date.now
  const sleep = deps.sleep ?? defaultSleep
  const timeoutMs = deps.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS

  return async function execute(): Promise<SyncAllProcessesResult> {
    const processIds = await deps.listActiveProcessIds()
    if (processIds.length === 0) {
      return { syncedProcesses: 0, syncedContainers: 0 }
    }

    const { containersByProcessId } = await deps.listContainersByProcessIds({ processIds })
    const syncTargets: SyncTarget[] = []

    for (const processId of processIds) {
      const containers = containersByProcessId.get(processId) ?? []
      for (const container of containers) {
        const provider = toSupportedProvider(container.carrierCode)
        if (provider === null) {
          const containerNumber = normalizeContainerNumber(container.containerNumber)
          const carrierCode = container.carrierCode ?? 'null'
          throw new HttpError(
            `unsupported_sync_provider_for_container:${containerNumber}:${carrierCode}`,
            422,
          )
        }

        const containerNumber = normalizeContainerNumber(container.containerNumber)
        if (containerNumber.length === 0) {
          throw new HttpError('invalid_container_number_for_sync', 422)
        }

        syncTargets.push({
          processId,
          containerNumber,
          provider,
        })
      }
    }

    if (syncTargets.length === 0) {
      return { syncedProcesses: 0, syncedContainers: 0 }
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
      throw new HttpError(`sync_global_failed:${firstError}`, 502)
    }

    const syncedProcesses = new Set(syncTargets.map((target) => target.processId)).size
    const syncedContainers = syncTargets.length

    return {
      syncedProcesses,
      syncedContainers,
    }
  }
}

export type SyncAllProcessesUseCase = ReturnType<typeof createSyncAllProcessesUseCase>
