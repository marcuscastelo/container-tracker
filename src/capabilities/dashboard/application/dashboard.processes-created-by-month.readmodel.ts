import type { DashboardProcessUseCases } from '~/capabilities/dashboard/application/dashboard.processes.projection'

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

function toMonthKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function toShortMonthLabel(date: Date): string {
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      timeZone: 'UTC',
    }).format(date)
  }

  return FALLBACK_MONTH_LABELS[date.getUTCMonth()] ?? '—'
}

function toCreatedAtDateOrNull(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return null
  }

  return new Date(timestamp)
}

function buildMonthWindow(
  now: Date,
  windowSize: DashboardMonthWindowSize,
): Array<{ month: string; label: string; count: number }> {
  const window: Array<{ month: string; label: string; count: number }> = []
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth()

  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const utcMonthDate = new Date(Date.UTC(currentYear, currentMonth - offset, 1))
    window.push({
      month: toMonthKeyFromDate(utcMonthDate),
      label: toShortMonthLabel(utcMonthDate),
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

    const monthWindow = buildMonthWindow(new Date(), windowSize)
    const monthIndexByKey = new Map(
      monthWindow.map((entry, index) => [entry.month, index] as const),
    )

    for (const process of processes) {
      const createdAt = toCreatedAtDateOrNull(process.pwc.process.createdAt)
      if (createdAt === null) {
        continue
      }

      const monthKey = toMonthKeyFromDate(createdAt)
      const monthIndex = monthIndexByKey.get(monthKey)
      if (monthIndex === undefined) {
        continue
      }

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
