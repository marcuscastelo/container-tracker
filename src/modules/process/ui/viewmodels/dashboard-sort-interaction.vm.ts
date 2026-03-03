import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

type SortableValue = string | number

function compareValues(left: SortableValue, right: SortableValue): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' })
}

function getEtaSortValue(process: ProcessSummaryVM): number {
  if (!process.eta) return Number.POSITIVE_INFINITY

  const parsed = Date.parse(process.eta)
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY

  return parsed
}

function getCreatedAtSortValue(process: ProcessSummaryVM): number {
  if (!process.lastEventAt) return Number.NEGATIVE_INFINITY

  const parsed = Date.parse(process.lastEventAt)
  if (Number.isNaN(parsed)) return Number.NEGATIVE_INFINITY

  return parsed
}

function getSortValue(process: ProcessSummaryVM, field: DashboardSortField): SortableValue {
  switch (field) {
    case 'processNumber':
      return process.reference ?? `<${process.id.slice(0, 8)}>`
    case 'importerName':
      return process.importerName ?? ''
    case 'createdAt':
      return getCreatedAtSortValue(process)
    case 'status':
      return process.status
    case 'eta':
      return getEtaSortValue(process)
    case 'provider':
      return process.carrier ?? ''
  }
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
  const multiplier = direction === 'asc' ? 1 : -1

  return [...processes].sort((left, right) => {
    const base = compareValues(getSortValue(left, field), getSortValue(right, field))
    return base * multiplier
  })
}
