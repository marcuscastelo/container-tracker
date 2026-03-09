import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import {
  TRACKING_STATUS_CODES,
  type TrackingStatusCode,
} from '~/modules/tracking/features/status/application/projection/tracking.status.projection'

const PT_BR_COLLATOR =
  typeof Intl !== 'undefined' && typeof Intl.Collator !== 'undefined'
    ? new Intl.Collator('pt-BR', { sensitivity: 'base' })
    : null

export type DashboardSeverityFilterValue = 'danger' | 'warning' | 'none'

export type DashboardFilterSelection = {
  readonly providers: readonly string[]
  readonly statuses: readonly TrackingStatusCode[]
  readonly importerId: string | null
  readonly importerName: string | null
  readonly severity: DashboardSeverityFilterValue | null
}

export type DashboardProviderFilterOption = {
  readonly value: string
  readonly count: number
}

export type DashboardStatusFilterOption = {
  readonly value: TrackingStatusCode
  readonly count: number
}

export type DashboardImporterFilterOption = {
  readonly importerId: string | null
  readonly importerName: string
  readonly label: string
  readonly count: number
}

export type DashboardImporterFilterValue = {
  readonly importerId: string | null
  readonly importerName: string
}

export type DashboardSeverityFilterOption = {
  readonly value: DashboardSeverityFilterValue
  readonly count: number
}

export const DASHBOARD_DEFAULT_FILTER_SELECTION: DashboardFilterSelection = {
  providers: [],
  statuses: [],
  importerId: null,
  importerName: null,
  severity: null,
}

export function hasActiveDashboardFilters(filterSelection: DashboardFilterSelection): boolean {
  const hasProviders = filterSelection.providers.length > 0
  const hasStatuses = filterSelection.statuses.length > 0
  const hasImporterId = toOptionalNonBlankString(filterSelection.importerId) !== null
  const hasImporterName = toOptionalNonBlankString(filterSelection.importerName) !== null
  const hasSeverity = filterSelection.severity !== null

  return hasProviders || hasStatuses || hasImporterId || hasImporterName || hasSeverity
}

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNormalizedNonBlankString(value: string | null | undefined): string | null {
  const nonBlankValue = toOptionalNonBlankString(value)
  if (nonBlankValue === null) return null
  return nonBlankValue.toLocaleLowerCase('pt-BR')
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
    severity: currentSelection.severity,
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
    severity: currentSelection.severity,
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

function toImporterOptionLabel(importerName: string, importerId: string | null): string {
  if (importerId === null || importerId === importerName) return importerName
  return `${importerName} (${importerId})`
}

export function deriveDashboardImporterFilterOptions(
  processes: readonly ProcessSummaryVM[],
): readonly DashboardImporterFilterOption[] {
  const countsByImporter = new Map<string, DashboardImporterFilterOption>()

  for (const process of processes) {
    const importerId = toOptionalNonBlankString(process.importerId)
    const importerName = toOptionalNonBlankString(process.importerName)

    if (importerId === null && importerName === null) continue

    const normalizedImporterName = importerName ?? importerId ?? ''
    const optionKey =
      importerId !== null
        ? `id:${importerId}`
        : `name:${toNormalizedNonBlankString(normalizedImporterName) ?? normalizedImporterName}`
    const currentOption = countsByImporter.get(optionKey)
    if (currentOption) {
      countsByImporter.set(optionKey, { ...currentOption, count: currentOption.count + 1 })
      continue
    }

    countsByImporter.set(optionKey, {
      importerId,
      importerName: normalizedImporterName,
      label: toImporterOptionLabel(normalizedImporterName, importerId),
      count: 1,
    })
  }

  const options = Array.from(countsByImporter.values())

  return options.sort((left, right) => {
    const byName = compareCaseInsensitive(left.importerName, right.importerName)
    if (byName !== 0) return byName

    if (left.importerId === null && right.importerId !== null) return 1
    if (left.importerId !== null && right.importerId === null) return -1
    if (left.importerId === null || right.importerId === null) return 0

    return compareCaseInsensitive(left.importerId, right.importerId)
  })
}

export function setDashboardImporterFilter(
  currentSelection: DashboardFilterSelection,
  importerFilter: DashboardImporterFilterValue | null,
): DashboardFilterSelection {
  return {
    providers: currentSelection.providers,
    statuses: currentSelection.statuses,
    importerId: importerFilter?.importerId ?? null,
    importerName: importerFilter?.importerName ?? null,
    severity: currentSelection.severity,
  }
}

export function setDashboardSeverityFilter(
  currentSelection: DashboardFilterSelection,
  severity: DashboardSeverityFilterValue | null,
): DashboardFilterSelection {
  return {
    providers: currentSelection.providers,
    statuses: currentSelection.statuses,
    importerId: currentSelection.importerId,
    importerName: currentSelection.importerName,
    severity,
  }
}

function toDashboardProcessDominantSeverity(
  process: ProcessSummaryVM,
): DashboardSeverityFilterValue {
  if (process.highestAlertSeverity === 'danger') return 'danger'
  if (process.highestAlertSeverity === 'warning') return 'warning'
  return 'none'
}

export function deriveDashboardSeverityFilterOptions(
  processes: readonly ProcessSummaryVM[],
): readonly DashboardSeverityFilterOption[] {
  const countsBySeverity = new Map<DashboardSeverityFilterValue, number>()

  for (const process of processes) {
    const severity = toDashboardProcessDominantSeverity(process)
    const currentCount = countsBySeverity.get(severity) ?? 0
    countsBySeverity.set(severity, currentCount + 1)
  }

  const ORDER: readonly DashboardSeverityFilterValue[] = ['danger', 'warning', 'none']

  return ORDER.flatMap((severity) => {
    const count = countsBySeverity.get(severity)
    if (!count) return []
    return [{ value: severity, count }]
  })
}

export function filterDashboardProcesses(
  processes: readonly ProcessSummaryVM[],
  filterSelection: DashboardFilterSelection,
): readonly ProcessSummaryVM[] {
  const hasProviderFilters = filterSelection.providers.length > 0
  const hasStatusFilters = filterSelection.statuses.length > 0
  const selectedImporterId = toOptionalNonBlankString(filterSelection.importerId)
  const selectedImporterName =
    selectedImporterId === null ? toNormalizedNonBlankString(filterSelection.importerName) : null
  const hasImporterFilter = selectedImporterId !== null || selectedImporterName !== null
  const hasSeverityFilter = filterSelection.severity !== null

  if (!hasProviderFilters && !hasStatusFilters && !hasImporterFilter && !hasSeverityFilter) {
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

    const matchesImporter =
      !hasImporterFilter ||
      (selectedImporterId !== null
        ? toOptionalNonBlankString(process.importerId) === selectedImporterId
        : toNormalizedNonBlankString(process.importerName) === selectedImporterName)

    const matchesSeverity =
      !hasSeverityFilter || toDashboardProcessDominantSeverity(process) === filterSelection.severity

    return matchesProvider && matchesStatus && matchesImporter && matchesSeverity
  })
}
