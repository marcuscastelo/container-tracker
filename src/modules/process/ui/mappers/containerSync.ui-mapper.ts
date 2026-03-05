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

export type ProcessSyncHeaderEntry = {
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

function toIsStale(lastSuccessAt: string | null, now: Date): boolean {
  if (lastSuccessAt === null) return false
  const successAt = Date.parse(lastSuccessAt)
  if (!Number.isFinite(successAt)) return false
  return now.getTime() - successAt > SYNC_STALE_THRESHOLD_MS
}

function toRelativeTimeLabel(
  state: ContainerSyncState,
  dto: ContainerSyncDTO,
  locale: string,
  now: Date,
): string | null {
  let timestamp: string | null = null
  if (state === 'ok') {
    timestamp = dto.lastSuccessAt
  } else if (state === 'error') {
    timestamp = dto.lastErrorAt
  }
  if (!timestamp) return null

  const relative = formatRelativeTime(timestamp, now, locale)
  return relative.length > 0 ? relative : null
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

export function toContainerSyncVM(
  dto: ContainerSyncDTO,
  locale: string,
  now: Date,
): ContainerSyncVM {
  const state = toState(dto)

  return {
    containerNumber: normalizeContainerNumber(dto.containerNumber),
    carrier: dto.carrier,
    state,
    relativeTimeLabel: toRelativeTimeLabel(state, dto, locale, now),
    isStale: state === 'ok' ? toIsStale(dto.lastSuccessAt, now) : false,
  }
}

export function createNeverContainerSyncVM(containerNumber: string): ContainerSyncVM {
  return {
    containerNumber: normalizeContainerNumber(containerNumber),
    carrier: null,
    state: 'never',
    relativeTimeLabel: null,
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
): string {
  if (sync.state === 'syncing') return messages.syncing
  if (sync.state === 'never') return messages.never

  if (sync.state === 'error') {
    return sync.relativeTimeLabel
      ? messages.failed(sync.relativeTimeLabel)
      : messages.failedUnknownTime
  }

  return sync.relativeTimeLabel
    ? messages.updated(sync.relativeTimeLabel)
    : messages.updatedUnknownTime
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
