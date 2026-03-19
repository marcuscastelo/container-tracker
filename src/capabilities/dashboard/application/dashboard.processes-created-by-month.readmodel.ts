import type { DashboardProcessUseCases } from '~/capabilities/dashboard/application/dashboard.processes.projection'
import { systemClock } from '~/shared/time/clock'
import { type Instant, isInstant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'

export type DashboardProcessesCreatedByMonthReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
}

export const DASHBOARD_MONTH_WINDOW_SIZES = [6, 12, 24] as const
export type DashboardMonthWindowSize = (typeof DASHBOARD_MONTH_WINDOW_SIZES)[number]
const DEFAULT_DASHBOARD_MONTH_WINDOW_SIZE: DashboardMonthWindowSize = 6

export type DashboardProcessesCreatedByMonthDatumReadModel = {
  readonly month: string
  readonly label: string
  readonly count: number
}

export type DashboardProcessesCreatedByMonthReadModel = {
  readonly months: readonly DashboardProcessesCreatedByMonthDatumReadModel[]
}

const FALLBACK_MONTH_LABELS: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function toMonthKeyFromInstant(instant: Instant): string {
  return instant.toCalendarDate('UTC').toIsoDate().slice(0, 7)
}

function toShortMonthLabel(month: number): string {
  return FALLBACK_MONTH_LABELS[month - 1] ?? '—'
}

function toCreatedAtInstantOrNull(value: Instant | string | null | undefined): Instant | null {
  if (isInstant(value)) return value
  if (typeof value !== 'string') return null
  return parseInstantFromIso(value)
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const absoluteMonth = year * 12 + (month - 1) + delta
  return {
    year: Math.floor(absoluteMonth / 12),
    month: (absoluteMonth % 12) + 1,
  }
}

function buildMonthWindow(
  now: Instant,
  windowSize: DashboardMonthWindowSize,
): Array<{ month: string; label: string; count: number }> {
  const nowDate = now.toCalendarDate('UTC').toIsoDate()
  const currentYear = Number(nowDate.slice(0, 4))
  const currentMonth = Number(nowDate.slice(5, 7))
  const window: Array<{ month: string; label: string; count: number }> = []

  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const shifted = shiftMonth(currentYear, currentMonth, -offset)
    window.push({
      month: toMonthKey(shifted.year, shifted.month),
      label: toShortMonthLabel(shifted.month),
      count: 0,
    })
  }

  return window
}

type DashboardProcessesCreatedByMonthReadModelCommand = {
  readonly windowSize?: DashboardMonthWindowSize
}

export function createDashboardProcessesCreatedByMonthReadModelUseCase(
  deps: DashboardProcessesCreatedByMonthReadModelDeps,
) {
  return async function execute(
    command: DashboardProcessesCreatedByMonthReadModelCommand = {},
  ): Promise<DashboardProcessesCreatedByMonthReadModel> {
    const { processes } = await deps.processUseCases.listProcessesWithOperationalSummary()
    const windowSize = command.windowSize ?? DEFAULT_DASHBOARD_MONTH_WINDOW_SIZE

    const monthWindow = buildMonthWindow(systemClock.now(), windowSize)
    const monthIndexByKey = new Map(
      monthWindow.map((entry, index) => [entry.month, index] as const),
    )

    for (const process of processes) {
      const createdAt = toCreatedAtInstantOrNull(process.pwc.process.createdAt)
      if (createdAt === null) continue

      const monthKey = toMonthKeyFromInstant(createdAt)
      const monthIndex = monthIndexByKey.get(monthKey)
      if (monthIndex === undefined) continue

      const currentEntry = monthWindow[monthIndex]
      monthWindow[monthIndex] = {
        ...currentEntry,
        count: currentEntry.count + 1,
      }
    }

    return {
      months: monthWindow,
    }
  }
}
