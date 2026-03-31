import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { toComparableInstant } from '~/shared/time/compare-temporal'
import { parseInstantFromIso, parseTemporalValue } from '~/shared/time/parsing'

const PT_BR_COLLATOR =
  typeof Intl !== 'undefined' && typeof Intl.Collator !== 'undefined'
    ? new Intl.Collator('pt-BR', { sensitivity: 'base' })
    : null

type MissingValuePolicy = 'directional' | 'always-last'

function compareNumbers(left: number, right: number): number {
  return left - right
}

function compareCaseInsensitiveStrings(left: string, right: string): number {
  if (PT_BR_COLLATOR) {
    return PT_BR_COLLATOR.compare(left, right)
  }
  return left.toLowerCase().localeCompare(right.toLowerCase())
}

function toDirectionMultiplier(direction: DashboardSortDirection): 1 | -1 {
  return direction === 'asc' ? 1 : -1
}

function compareByDirection(baseComparison: number, direction: DashboardSortDirection): number {
  return baseComparison * toDirectionMultiplier(direction)
}

function getDefaultSortDirection(field: DashboardSortField): DashboardSortDirection {
  if (field === 'eta') return 'asc'
  return 'desc'
}

function getOppositeSortDirection(direction: DashboardSortDirection): DashboardSortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}

function normalizeSortableString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function compareNullableValues<T>(
  left: T | null,
  right: T | null,
  direction: DashboardSortDirection,
  missingValuePolicy: MissingValuePolicy,
  compareBase: (leftValue: T, rightValue: T) => number,
): number {
  const leftIsMissing = left === null
  const rightIsMissing = right === null

  if (leftIsMissing && rightIsMissing) return 0

  if (leftIsMissing || rightIsMissing) {
    if (missingValuePolicy === 'always-last') {
      return leftIsMissing ? 1 : -1
    }

    if (direction === 'asc') {
      return leftIsMissing ? 1 : -1
    }

    return leftIsMissing ? -1 : 1
  }

  return compareByDirection(compareBase(left, right), direction)
}

function compareNullableStringValues(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: DashboardSortDirection,
): number {
  return compareNullableValues(
    normalizeSortableString(left),
    normalizeSortableString(right),
    direction,
    'directional',
    compareCaseInsensitiveStrings,
  )
}

function compareNullableNumberValues(
  left: number | null,
  right: number | null,
  direction: DashboardSortDirection,
  missingValuePolicy: MissingValuePolicy,
): number {
  return compareNullableValues(left, right, direction, missingValuePolicy, compareNumbers)
}

function compareNullableDateValues(
  left: number | null,
  right: number | null,
  direction: DashboardSortDirection,
): number {
  return compareNullableNumberValues(left, right, direction, 'always-last')
}

function toCreatedAtSortValue(process: ProcessSummaryVM): number | null {
  // Prefer dominantAlertCreatedAt (alert age basis). Fall back to lastEventAt for compatibility.
  const ts = process.dominantAlertCreatedAt ?? process.lastEventAt
  if (!ts) return null
  if (typeof ts === 'string') {
    return parseInstantFromIso(ts)?.toEpochMs() ?? null
  }

  const parsedTemporal = parseTemporalValue(ts)
  if (parsedTemporal === null) return null
  return toComparableInstant(parsedTemporal, {
    timezone: 'UTC',
    strategy: 'start-of-day',
  }).toEpochMs()
}

function toProcessNumberSortValue(process: ProcessSummaryVM): string | null {
  return normalizeSortableString(process.reference)
}

/** Severity weight for sort ordering (lower = higher priority). */
const SEVERITY_RANK: Record<string, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  none: 3,
}

function toAlertsSortValue(process: ProcessSummaryVM): number {
  const sevRank = SEVERITY_RANK[process.highestAlertSeverity ?? 'none'] ?? 3
  // Pack severity and count into a single number: lower severity rank = higher priority,
  // then higher count = higher priority within the same severity tier.
  return sevRank * 10_000 - process.alertsCount
}

function compareBySortField(
  left: ProcessSummaryVM,
  right: ProcessSummaryVM,
  field: DashboardSortField,
  direction: DashboardSortDirection,
): number {
  switch (field) {
    case 'processNumber':
      return compareNullableStringValues(
        toProcessNumberSortValue(left),
        toProcessNumberSortValue(right),
        direction,
      )
    case 'importerName':
      return compareNullableStringValues(left.importerName, right.importerName, direction)
    case 'exporterName':
      return compareNullableStringValues(left.exporterName, right.exporterName, direction)
    case 'createdAt':
      return compareNullableDateValues(
        toCreatedAtSortValue(left),
        toCreatedAtSortValue(right),
        direction,
      )
    case 'status':
      return compareNullableNumberValues(
        left.statusRank,
        right.statusRank,
        direction,
        'directional',
      )
    case 'eta':
      return compareNullableDateValues(left.etaMsOrNull, right.etaMsOrNull, direction)
    case 'alerts':
      return compareNullableNumberValues(
        toAlertsSortValue(left),
        toAlertsSortValue(right),
        direction,
        'directional',
      )
    case 'provider':
      return compareNullableStringValues(left.carrier, right.carrier, direction)
  }
}

function compareByCreatedAtDescending(left: ProcessSummaryVM, right: ProcessSummaryVM): number {
  return compareNullableDateValues(toCreatedAtSortValue(left), toCreatedAtSortValue(right), 'desc')
}

function compareByProcessNumberAscendingWithMissingLast(
  left: ProcessSummaryVM,
  right: ProcessSummaryVM,
): number {
  return compareNullableValues(
    toProcessNumberSortValue(left),
    toProcessNumberSortValue(right),
    'asc',
    'always-last',
    compareCaseInsensitiveStrings,
  )
}

function compareByProcessIdAscending(left: ProcessSummaryVM, right: ProcessSummaryVM): number {
  return compareCaseInsensitiveStrings(left.id, right.id)
}

function compareByProcessNumberAscendingWithIdFallback(
  left: ProcessSummaryVM,
  right: ProcessSummaryVM,
): number {
  const processNumberComparison = compareByProcessNumberAscendingWithMissingLast(left, right)

  if (processNumberComparison !== 0) {
    return processNumberComparison
  }

  // Fallback keeps null process numbers and duplicate references deterministic.
  return compareByProcessIdAscending(left, right)
}

function compareWithDeterministicTieBreaks(
  left: ProcessSummaryVM,
  right: ProcessSummaryVM,
  field: DashboardSortField,
  direction: DashboardSortDirection,
): number {
  const primaryComparison = compareBySortField(left, right, field, direction)
  if (primaryComparison !== 0) return primaryComparison

  const createdAtTieBreak = compareByCreatedAtDescending(left, right)
  if (createdAtTieBreak !== 0) return createdAtTieBreak

  return compareByProcessNumberAscendingWithIdFallback(left, right)
}

export function getActiveDashboardSortDirection(
  sortSelection: DashboardSortSelection,
  field: DashboardSortField,
): DashboardSortDirection | null {
  if (!sortSelection || sortSelection.field !== field) return null
  return sortSelection.direction
}

export function nextDashboardSortSelection(
  currentSelection: DashboardSortSelection,
  field: DashboardSortField,
): DashboardSortSelection {
  const currentDirection = getActiveDashboardSortDirection(currentSelection, field)
  const defaultDirection = getDefaultSortDirection(field)

  if (!currentDirection) {
    return { field, direction: defaultDirection }
  }

  if (currentDirection === defaultDirection) {
    return { field, direction: getOppositeSortDirection(defaultDirection) }
  }

  return null
}

export function sortDashboardProcesses(
  processes: readonly ProcessSummaryVM[],
  sortSelection: DashboardSortSelection,
): readonly ProcessSummaryVM[] {
  if (!sortSelection) return processes

  const { field, direction } = sortSelection

  return [...processes].sort((left, right) => {
    return compareWithDeterministicTieBreaks(left, right, field, direction)
  })
}
