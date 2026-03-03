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

function toCreatedAtSortValue(process: ProcessSummaryVM): number {
  if (!process.lastEventAt) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(process.lastEventAt)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function toProcessNumberSortValue(process: ProcessSummaryVM): string {
  return process.reference ?? `<${process.id.slice(0, 8)}>`
}

function toProcessNumberTieBreakSortValue(process: ProcessSummaryVM): string {
  return process.reference ?? process.id
}

function compareEtaMsOrNull(
  left: number | null,
  right: number | null,
  direction: DashboardSortDirection,
): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return compareByDirection(compareNumbers(left, right), direction)
}

function compareBySortField(
  left: ProcessSummaryVM,
  right: ProcessSummaryVM,
  field: DashboardSortField,
  direction: DashboardSortDirection,
): number {
  switch (field) {
    case 'processNumber':
      return compareByDirection(
        compareCaseInsensitiveStrings(
          toProcessNumberSortValue(left),
          toProcessNumberSortValue(right),
        ),
        direction,
      )
    case 'importerName':
      return compareByDirection(
        compareCaseInsensitiveStrings(left.importerName ?? '', right.importerName ?? ''),
        direction,
      )
    case 'createdAt':
      return compareByDirection(
        compareNumbers(toCreatedAtSortValue(left), toCreatedAtSortValue(right)),
        direction,
      )
    case 'status':
      return compareByDirection(compareNumbers(left.statusRank, right.statusRank), direction)
    case 'eta':
      return compareEtaMsOrNull(left.etaMsOrNull, right.etaMsOrNull, direction)
    case 'provider':
      return compareByDirection(
        compareCaseInsensitiveStrings(left.carrier ?? '', right.carrier ?? ''),
        direction,
      )
  }
}

function compareByCreatedAtDescending(left: ProcessSummaryVM, right: ProcessSummaryVM): number {
  return compareByDirection(
    compareNumbers(toCreatedAtSortValue(left), toCreatedAtSortValue(right)),
    'desc',
  )
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
