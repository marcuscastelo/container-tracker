import {
  type ProcessStatusCode,
  processStatusToVariant,
  toProcessStatusCode,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import type { ProcessStatusMicrobadgeVM } from '~/modules/process/ui/viewmodels/process-status-microbadge.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

type ProcessStatusMicrobadgeSource =
  | {
      readonly status?: string | null | undefined
      readonly count?: number | null | undefined
    }
  | null
  | undefined

type ProcessStatusMicrobadgeDisplayVM = {
  readonly label: string
  readonly variant: StatusVariant
}

const MICROBADGE_MEANINGFUL_STATUS_CODES: ReadonlySet<ProcessStatusCode> = new Set([
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
])

function isMeaningfulMicrobadgeStatusCode(statusCode: ProcessStatusCode): boolean {
  return MICROBADGE_MEANINGFUL_STATUS_CODES.has(statusCode)
}

function toPluralForm(count: number): 'one' | 'other' {
  return count === 1 ? 'one' : 'other'
}

function toMicrobadgeLabelKey(command: {
  readonly keys: TranslationKeys
  readonly statusCode: ProcessStatusCode
  readonly count: number
}): string | null {
  const pluralForm = toPluralForm(command.count)

  if (command.statusCode === 'ARRIVED_AT_POD') {
    return pluralForm === 'one'
      ? command.keys.tracking.statusMicrobadge.ARRIVED_AT_POD.one
      : command.keys.tracking.statusMicrobadge.ARRIVED_AT_POD.other
  }

  if (command.statusCode === 'DISCHARGED') {
    return pluralForm === 'one'
      ? command.keys.tracking.statusMicrobadge.DISCHARGED.one
      : command.keys.tracking.statusMicrobadge.DISCHARGED.other
  }

  if (command.statusCode === 'AVAILABLE_FOR_PICKUP') {
    return pluralForm === 'one'
      ? command.keys.tracking.statusMicrobadge.AVAILABLE_FOR_PICKUP.one
      : command.keys.tracking.statusMicrobadge.AVAILABLE_FOR_PICKUP.other
  }

  if (command.statusCode === 'DELIVERED') {
    return pluralForm === 'one'
      ? command.keys.tracking.statusMicrobadge.DELIVERED.one
      : command.keys.tracking.statusMicrobadge.DELIVERED.other
  }

  if (command.statusCode === 'EMPTY_RETURNED') {
    return pluralForm === 'one'
      ? command.keys.tracking.statusMicrobadge.EMPTY_RETURNED.one
      : command.keys.tracking.statusMicrobadge.EMPTY_RETURNED.other
  }

  return null
}

export function toProcessStatusMicrobadgeVM(
  source: ProcessStatusMicrobadgeSource,
): ProcessStatusMicrobadgeVM | null {
  if (!source) return null

  const rawCount = source.count
  if (typeof rawCount !== 'number') return null
  if (!Number.isInteger(rawCount) || rawCount <= 0) return null

  const statusCode = toProcessStatusCode(source.status)
  if (!isMeaningfulMicrobadgeStatusCode(statusCode)) return null

  return {
    statusCode,
    count: rawCount,
  }
}

function processStatusMicrobadgeToVariant(statusCode: ProcessStatusCode): StatusVariant {
  return processStatusToVariant(statusCode)
}

export function processStatusMicrobadgeToLabel(command: {
  readonly t: (key: string, options?: Record<string, unknown>) => string
  readonly keys: TranslationKeys
  readonly microbadge: ProcessStatusMicrobadgeVM
}): string | null {
  const key = toMicrobadgeLabelKey({
    keys: command.keys,
    statusCode: command.microbadge.statusCode,
    count: command.microbadge.count,
  })

  if (!key) return null

  return command.t(key, {
    count: command.microbadge.count,
  })
}

export function toProcessStatusMicrobadgeDisplayVM(command: {
  readonly t: (key: string, options?: Record<string, unknown>) => string
  readonly keys: TranslationKeys
  readonly microbadge: ProcessStatusMicrobadgeVM | null
}): ProcessStatusMicrobadgeDisplayVM | null {
  if (command.microbadge === null) return null

  const label = processStatusMicrobadgeToLabel({
    t: command.t,
    keys: command.keys,
    microbadge: command.microbadge,
  })
  if (label === null) return null

  return {
    label,
    variant: processStatusMicrobadgeToVariant(command.microbadge.statusCode),
  }
}
