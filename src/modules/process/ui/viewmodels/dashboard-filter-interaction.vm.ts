import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import {
  TRACKING_STATUS_CODES,
  type TrackingStatusCode,
} from '~/modules/tracking/application/projection/tracking.status.projection'

const PT_BR_COLLATOR =
  typeof Intl !== 'undefined' && typeof Intl.Collator !== 'undefined'
    ? new Intl.Collator('pt-BR', { sensitivity: 'base' })
    : null

export type DashboardFilterSelection = {
  readonly providers: readonly string[]
  readonly statuses: readonly TrackingStatusCode[]
  readonly importerId: string | null
  readonly importerName: string | null
}

export type DashboardProviderFilterOption = {
  readonly value: string
  readonly count: number
}

export type DashboardStatusFilterOption = {
  readonly value: TrackingStatusCode
  readonly count: number
}

export const DASHBOARD_DEFAULT_FILTER_SELECTION: DashboardFilterSelection = {
  providers: [],
  statuses: [],
  importerId: null,
  importerName: null,
}

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function compareCaseInsensitive(left: string, right: string): number {
  if (PT_BR_COLLATOR) {
    return PT_BR_COLLATOR.compare(left, right)
  }

  return left.toLowerCase().localeCompare(right.toLowerCase())
}

function toggleSelectionValue<T extends string>(
  currentValues: readonly T[],
  toggledValue: T,
): readonly T[] {
  if (currentValues.some((value) => value === toggledValue)) {
    return currentValues.filter((value) => value !== toggledValue)
  }

  return [...currentValues, toggledValue]
}

export function toggleDashboardProviderFilter(
  currentSelection: DashboardFilterSelection,
  provider: string,
): DashboardFilterSelection {
  return {
    providers: toggleSelectionValue(currentSelection.providers, provider),
    statuses: currentSelection.statuses,
    importerId: currentSelection.importerId,
    importerName: currentSelection.importerName,
  }
}

export function toggleDashboardStatusFilter(
  currentSelection: DashboardFilterSelection,
  status: TrackingStatusCode,
): DashboardFilterSelection {
  return {
    providers: currentSelection.providers,
    statuses: toggleSelectionValue(currentSelection.statuses, status),
    importerId: currentSelection.importerId,
    importerName: currentSelection.importerName,
  }
}

export function deriveDashboardProviderFilterOptions(
  processes: readonly ProcessSummaryVM[],
): readonly DashboardProviderFilterOption[] {
  const countsByProvider = new Map<string, number>()

  for (const process of processes) {
    const provider = toOptionalNonBlankString(process.carrier)
    if (!provider) continue

    const currentCount = countsByProvider.get(provider) ?? 0
    countsByProvider.set(provider, currentCount + 1)
  }

  const options = Array.from(countsByProvider.entries()).map(([value, count]) => ({ value, count }))

  return options.sort((left, right) => compareCaseInsensitive(left.value, right.value))
}

export function deriveDashboardStatusFilterOptions(
  processes: readonly ProcessSummaryVM[],
): readonly DashboardStatusFilterOption[] {
  const countsByStatus = new Map<TrackingStatusCode, number>()

  for (const process of processes) {
    const currentCount = countsByStatus.get(process.statusCode) ?? 0
    countsByStatus.set(process.statusCode, currentCount + 1)
  }

  return TRACKING_STATUS_CODES.flatMap((statusCode) => {
    const count = countsByStatus.get(statusCode)
    if (!count) return []
    return [{ value: statusCode, count }]
  })
}

export function filterDashboardProcesses(
  processes: readonly ProcessSummaryVM[],
  filterSelection: DashboardFilterSelection,
): readonly ProcessSummaryVM[] {
  const hasProviderFilters = filterSelection.providers.length > 0
  const hasStatusFilters = filterSelection.statuses.length > 0

  if (!hasProviderFilters && !hasStatusFilters) {
    return processes
  }

  return processes.filter((process) => {
    const matchesProvider =
      !hasProviderFilters ||
      (process.carrier !== null &&
        filterSelection.providers.some((provider) => provider === process.carrier))

    const matchesStatus =
      !hasStatusFilters ||
      filterSelection.statuses.some((statusCode) => statusCode === process.statusCode)

    return matchesProvider && matchesStatus
  })
}
