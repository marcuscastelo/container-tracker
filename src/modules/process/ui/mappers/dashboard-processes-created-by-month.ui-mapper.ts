import type { DashboardMonthlyBarDatumVM } from '~/modules/process/ui/viewmodels/dashboard-monthly-bar-datum.vm'
import type { DashboardProcessesCreatedByMonthResponse } from '~/shared/api-schemas/dashboard.schemas'

function toLocalizedMonthLabel(command: {
  readonly monthKey: string
  readonly locale: string
  readonly fallbackLabel: string
}): string {
  const [yearPart, monthPart] = command.monthKey.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return command.fallbackLabel
  }

  const monthDate = new Date(Date.UTC(year, month - 1, 1))
  return new Intl.DateTimeFormat(command.locale, {
    month: 'short',
    timeZone: 'UTC',
  }).format(monthDate)
}

export function toDashboardMonthlyBarDatumVMs(
  source: DashboardProcessesCreatedByMonthResponse,
  locale: string,
): readonly DashboardMonthlyBarDatumVM[] {
  return source.months.map((item) => ({
    key: item.month,
    label: toLocalizedMonthLabel({
      monthKey: item.month,
      locale,
      fallbackLabel: item.label,
    }),
    value: item.count,
  }))
}
