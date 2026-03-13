import type { DashboardKpiVM } from '~/modules/process/ui/viewmodels/dashboard-kpi.vm'
import type { DashboardKpisResponse } from '~/shared/api-schemas/dashboard.schemas'

type DashboardKpiLabels = {
  readonly activeProcesses: string
  readonly trackedContainers: string
  readonly processesWithAlerts: string
  readonly lastSync: string
  readonly lastSyncUnavailable: string
}

type DashboardKpiUiMapperCommand = {
  readonly source: DashboardKpisResponse
  readonly labels: DashboardKpiLabels
  readonly locale: string
  readonly icons: {
    readonly activeProcesses: DashboardKpiVM['icon']
    readonly trackedContainers: DashboardKpiVM['icon']
    readonly processesWithAlerts: DashboardKpiVM['icon']
    readonly lastSync: DashboardKpiVM['icon']
  }
}

function formatInteger(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

function formatLastSyncAt(
  value: DashboardKpisResponse['lastSyncAt'],
  command: Pick<DashboardKpiUiMapperCommand, 'locale' | 'labels'>,
): string {
  if (value === null) {
    return command.labels.lastSyncUnavailable
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return command.labels.lastSyncUnavailable
  }

  return new Intl.DateTimeFormat(command.locale, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed))
}

export function toDashboardKpiVMs(command: DashboardKpiUiMapperCommand): readonly DashboardKpiVM[] {
  return [
    {
      label: command.labels.activeProcesses,
      value: formatInteger(command.source.activeProcesses, command.locale),
      icon: command.icons.activeProcesses,
      tone: 'default',
    },
    {
      label: command.labels.trackedContainers,
      value: formatInteger(command.source.trackedContainers, command.locale),
      icon: command.icons.trackedContainers,
      tone: 'default',
    },
    {
      label: command.labels.processesWithAlerts,
      value: formatInteger(command.source.processesWithAlerts, command.locale),
      icon: command.icons.processesWithAlerts,
      tone: 'warning',
    },
    {
      label: command.labels.lastSync,
      value: formatLastSyncAt(command.source.lastSyncAt, command),
      icon: command.icons.lastSync,
      tone: 'default',
    },
  ]
}
