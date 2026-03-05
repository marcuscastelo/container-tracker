import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import type {
  ContainerDetailVM,
  ContainerSyncState,
  ContainerSyncVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'

const SYNC_STALE_THRESHOLD_HOURS = 24
const SYNC_STALE_THRESHOLD_MS = SYNC_STALE_THRESHOLD_HOURS * 60 * 60 * 1000

type ContainerSyncDTO = ProcessDetailResponse['containersSync'][number]

type ProcessSyncHeaderEntry = {
  readonly containerNumber: string
  readonly carrier: string | null
  readonly sync: ContainerSyncVM
}

type ContainerSyncLabelMessages = {
  readonly syncing: string
  readonly never: string
  readonly updatedUnknownTime: string
  readonly failedUnknownTime: string
  readonly updated: (relative: string) => string
  readonly failed: (relative: string) => string
}

function toTimestampOrNegativeInfinity(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function isMoreRecent(candidate: string, base: string): boolean {
  return toTimestampOrNegativeInfinity(candidate) > toTimestampOrNegativeInfinity(base)
}

function toState(dto: ContainerSyncDTO): ContainerSyncState {
  if (dto.isSyncing) return 'syncing'

  if (
    dto.lastErrorAt !== null &&
    (dto.lastSuccessAt === null || isMoreRecent(dto.lastErrorAt, dto.lastSuccessAt))
  ) {
    return 'error'
  }

  if (dto.lastSuccessAt !== null) return 'ok'
  return 'never'
}

function toRelativeTimeAt(state: ContainerSyncState, dto: ContainerSyncDTO): string | null {
  let timestamp: string | null = null
  if (state === 'ok') {
    timestamp = dto.lastSuccessAt
  } else if (state === 'error') {
    timestamp = dto.lastErrorAt
  }
  return timestamp
}

function toSyncPriority(sync: ContainerSyncVM): number {
  if (sync.state === 'syncing') return 0
  if (sync.state === 'error') return 1
  if (sync.state === 'ok' && sync.isStale) return 2
  if (sync.state === 'ok') return 3
  return 4
}

export function normalizeContainerNumber(containerNumber: string): string {
  return containerNumber.trim().toUpperCase()
}

export function toContainerSyncVM(dto: ContainerSyncDTO, now: Date): ContainerSyncVM {
  const state = toState(dto)

  const lastSuccessAtTimestamp =
    dto.lastSuccessAt === null ? null : toTimestampOrNegativeInfinity(dto.lastSuccessAt)
  const isStale =
    state === 'ok' &&
    lastSuccessAtTimestamp !== null &&
    Number.isFinite(lastSuccessAtTimestamp) &&
    now.getTime() - lastSuccessAtTimestamp > SYNC_STALE_THRESHOLD_MS

  return {
    containerNumber: normalizeContainerNumber(dto.containerNumber),
    carrier: dto.carrier,
    state,
    relativeTimeAt: toRelativeTimeAt(state, dto),
    isStale,
  }
}

export function createNeverContainerSyncVM(containerNumber: string): ContainerSyncVM {
  return {
    containerNumber: normalizeContainerNumber(containerNumber),
    carrier: null,
    state: 'never',
    relativeTimeAt: null,
    isStale: false,
  }
}

export function sortProcessSyncHeaderEntries(
  entries: readonly ProcessSyncHeaderEntry[],
): readonly ProcessSyncHeaderEntry[] {
  return [...entries].sort((a, b) => {
    const priorityDelta = toSyncPriority(a.sync) - toSyncPriority(b.sync)
    if (priorityDelta !== 0) return priorityDelta
    return a.containerNumber.localeCompare(b.containerNumber)
  })
}

export function resolveProcessSyncHeaderMode(
  entries: readonly ProcessSyncHeaderEntry[],
): 'syncing' | 'updated' {
  return entries.some((entry) => entry.sync.state === 'syncing') ? 'syncing' : 'updated'
}

export function toContainerSyncLabel(
  sync: ContainerSyncVM,
  messages: ContainerSyncLabelMessages,
  command?: {
    readonly now?: Date
    readonly locale?: string
  },
): string {
  if (sync.state === 'syncing') return messages.syncing
  if (sync.state === 'never') return messages.never

  const relativeTimeLabel = sync.relativeTimeAt
    ? formatRelativeTime(
        sync.relativeTimeAt,
        command?.now ?? new Date(),
        command?.locale ?? 'en-US',
      )
    : ''
  const hasRelativeTimeLabel = relativeTimeLabel.length > 0

  if (sync.state === 'error') {
    return hasRelativeTimeLabel ? messages.failed(relativeTimeLabel) : messages.failedUnknownTime
  }

  return hasRelativeTimeLabel ? messages.updated(relativeTimeLabel) : messages.updatedUnknownTime
}

export function toProcessSyncHeaderEntries(command: {
  readonly containers: readonly Pick<ContainerDetailVM, 'number' | 'carrierCode' | 'sync'>[]
  readonly processCarrier: string | null | undefined
}): readonly ProcessSyncHeaderEntry[] {
  return sortProcessSyncHeaderEntries(
    command.containers.map((container) => ({
      containerNumber: normalizeContainerNumber(container.number),
      carrier: container.sync.carrier ?? container.carrierCode ?? command.processCarrier ?? null,
      sync: container.sync,
    })),
  )
}
