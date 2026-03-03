import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

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
  if (!process.lastEventAt) return null
  const parsed = Date.parse(process.lastEventAt)
  return Number.isNaN(parsed) ? null : parsed
}

function toProcessNumberSortValue(process: ProcessSummaryVM): string | null {
  return normalizeSortableString(process.reference)
}

function toProcessNumberTieBreakSortValue(process: ProcessSummaryVM): string {
  return normalizeSortableString(process.reference) ?? process.id
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
    case 'provider':
      return compareNullableStringValues(left.carrier, right.carrier, direction)
  }
}

function compareByCreatedAtDescending(left: ProcessSummaryVM, right: ProcessSummaryVM): number {
  return compareNullableDateValues(toCreatedAtSortValue(left), toCreatedAtSortValue(right), 'desc')
}

function compareByProcessNumberAscendingWithIdFallback(
  left: ProcessSummaryVM,
  right: ProcessSummaryVM,
): number {
  const processNumberComparison = compareCaseInsensitiveStrings(
    toProcessNumberTieBreakSortValue(left),
    toProcessNumberTieBreakSortValue(right),
  )

  if (processNumberComparison !== 0) {
    return processNumberComparison
  }

  return compareCaseInsensitiveStrings(left.id, right.id)
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

  if (!currentDirection) {
    return { field, direction: 'desc' }
  }

  if (currentDirection === 'desc') {
    return { field, direction: 'asc' }
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
