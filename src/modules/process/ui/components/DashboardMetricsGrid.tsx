import type { JSX } from 'solid-js'
import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { MetricCard } from '~/shared/ui/MetricCard'

type Props = {
  readonly summary: DashboardGlobalAlertsVM | null
  readonly loading: boolean
  readonly hasError: boolean
}

function TotalIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v18m9-9H3" />
    </svg>
  )
}

function DangerIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 9v3m0 3h.01m-7.732 4h15.464c1.308 0 2.126-1.417 1.472-2.55L13.732 4.45c-.654-1.133-2.29-1.133-2.944 0L2.806 16.45c-.654 1.133.164 2.55 1.472 2.55z"
      />
    </svg>
  )
}

function WarningIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 8v4m0 4h.01M4 20l8-16 8 16H4z"
      />
    </svg>
  )
}

function InfoIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function computeSeveritySubtitle(key: string): string | undefined {
  if (key === 'danger') return 'danger'
  if (key === 'warning') return 'warning'
  return undefined
}

export function DashboardMetricsGrid(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const safeSummary = () =>
    props.summary ?? {
      totalActiveAlerts: 0,
      bySeverity: {
        danger: 0,
        warning: 0,
        info: 0,
        success: 0,
      },
      byCategory: {
        eta: 0,
        movement: 0,
        customs: 0,
        status: 0,
        data: 0,
      },
    }

  const severityCards = () => [
    {
      key: 'danger',
      label: t(keys.dashboard.alertIndicators.severity.danger),
      value: safeSummary().bySeverity.danger,
      icon: <DangerIcon />,
      variant: 'danger' as const,
    },
    {
      key: 'warning',
      label: t(keys.dashboard.alertIndicators.severity.warning),
      value: safeSummary().bySeverity.warning,
      icon: <WarningIcon />,
      variant: 'warning' as const,
    },
    {
      key: 'info',
      label: t(keys.dashboard.alertIndicators.severity.info),
      value: safeSummary().bySeverity.info,
      icon: <InfoIcon />,
      variant: 'info' as const,
    },
  ]

  const visibleSeverityCards = () => severityCards().filter((c) => c.value > 0)

  const categoryCards = () => [
    {
      key: 'eta',
      label: t(keys.dashboard.alertIndicators.category.eta),
      value: safeSummary().byCategory.eta,
    },
    {
      key: 'movement',
      label: t(keys.dashboard.alertIndicators.category.movement),
      value: safeSummary().byCategory.movement,
    },
    {
      key: 'customs',
      label: t(keys.dashboard.alertIndicators.category.customs),
      value: safeSummary().byCategory.customs,
    },
    {
      key: 'status',
      label: t(keys.dashboard.alertIndicators.category.status),
      value: safeSummary().byCategory.status,
    },
    {
      key: 'data',
      label: t(keys.dashboard.alertIndicators.category.data),
      value: safeSummary().byCategory.data,
    },
  ]

  const visibleCategoryCards = () => categoryCards().filter((c) => c.value > 0)

  const computeSubtitleText = (key: string | undefined): string | undefined => {
    if (key === 'danger') return t(keys.dashboard.alertIndicators.subtitle.severity.danger)
    if (key === 'warning') return t(keys.dashboard.alertIndicators.subtitle.severity.warning)
    return undefined
  }

  const severityNodes = () =>
    visibleSeverityCards().map((card) => (
      <div class="flex-1 min-w-[220px] basis-[220px]">
        <MetricCard
          icon={card.icon}
          label={card.label}
          value={card.value}
          variant={card.variant}
          subtitle={computeSubtitleText(computeSeveritySubtitle(card.key))}
        />
      </div>
    ))

  const categoryNodes = () =>
    visibleCategoryCards().map((card) => (
      <div class="flex-1 min-w-[220px] basis-[220px]">
        <MetricCard
          icon={<InfoIcon />}
          label={card.label}
          value={card.value}
          variant={card.value > 0 ? 'info' : 'default'}
        />
      </div>
    ))

  const state = () => {
    if (props.loading) return 'loading'
    if (props.hasError) return 'error'
    if (safeSummary().totalActiveAlerts === 0) return 'empty'
    return 'ready'
  }

  return (
    <section class="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-4 py-2.5">
        <h2 class="text-[13px] font-semibold text-slate-900">
          {t(keys.dashboard.alertIndicators.title)}
        </h2>
      </header>

      {state() === 'loading' && (
        <div class="px-4 py-8 text-center text-[13px] text-slate-400">
          {t(keys.dashboard.alertIndicators.loading)}
        </div>
      )}

      {state() === 'error' && (
        <div class="px-4 py-8 text-center text-[13px] text-red-500">
          {t(keys.dashboard.alertIndicators.error)}
        </div>
      )}

      {(state() === 'empty' || state() === 'ready') && (
        <div class="space-y-4 px-4 py-3">
          <div class="flex flex-wrap gap-2 items-stretch">
            <div class="flex-1 min-w-[220px] basis-[220px]">
              <MetricCard
                icon={<TotalIcon />}
                label={t(keys.dashboard.alertIndicators.total)}
                value={safeSummary().totalActiveAlerts}
                subtitle={t(keys.dashboard.alertIndicators.subtitle.total)}
              />
            </div>
            {severityNodes()}
          </div>

          <div class="flex flex-wrap gap-2 items-stretch">{categoryNodes()}</div>

          {state() === 'empty' && (
            <p class="text-center text-[12px] text-slate-500">
              {t(keys.dashboard.alertIndicators.empty)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
