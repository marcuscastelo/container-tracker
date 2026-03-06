import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { MetricCard } from '~/shared/ui/MetricCard'

type Props = {
  readonly summary: DashboardGlobalAlertsVM | null
  readonly loading: boolean
  readonly hasError: boolean
}

type GridState = 'loading' | 'error' | 'empty' | 'ready'

function _TotalIcon(): JSX.Element {
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

function CategorySummaryChip(props: { value: number; label: string }): JSX.Element {
  return (
    <span class="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
      <span class="font-bold tabular-nums">{props.value}</span>
      {props.label}
    </span>
  )
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

  const _severityNodes = () =>
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

  const _categoryNodes = () =>
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

  const severitySummaryItems = () => {
    const summary = safeSummary()
    return [
      {
        key: 'danger',
        dotClass: 'bg-red-500',
        valueClass: 'text-red-700',
        labelClass: 'text-red-600',
        value: summary.bySeverity.danger,
        label: t(keys.dashboard.triageSummary.critical),
      },
      {
        key: 'warning',
        dotClass: 'bg-yellow-400',
        valueClass: 'text-yellow-700',
        labelClass: 'text-yellow-600',
        value: summary.bySeverity.warning,
        label: t(keys.dashboard.triageSummary.warning),
      },
      {
        key: 'info',
        dotClass: 'bg-blue-400',
        valueClass: 'text-blue-700',
        labelClass: 'text-blue-600',
        value: summary.bySeverity.info,
        label: t(keys.dashboard.alertIndicators.severity.info),
      },
    ].filter((item) => item.value > 0)
  }

  const renderBody = (currentState: GridState): JSX.Element => {
    if (currentState === 'loading') {
      return (
        <div class="px-4 py-8 text-center text-[14px] text-slate-400">
          {t(keys.dashboard.alertIndicators.loading)}
        </div>
      )
    }

    if (currentState === 'error') {
      return (
        <div class="px-4 py-8 text-center text-[14px] text-red-500">
          {t(keys.dashboard.alertIndicators.error)}
        </div>
      )
    }

    const summary = safeSummary()

    return (
      <div class="px-4 py-3">
        {/* Phase 10: Compact Triage Summary Bar */}
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="text-[22px] font-bold tabular-nums text-slate-900">
              {summary.totalActiveAlerts}
            </span>
            <span class="text-[12px] font-medium text-slate-500">
              {t(keys.dashboard.alertIndicators.total)}
            </span>
          </div>

          <For each={severitySummaryItems()}>
            {(item) => (
              <div class="flex items-center gap-1">
                <span class={`h-2 w-2 rounded-full ${item.dotClass}`} />
                <span class={`text-[14px] font-bold tabular-nums ${item.valueClass}`}>
                  {item.value}
                </span>
                <span class={`text-[12px] font-medium ${item.labelClass}`}>{item.label}</span>
              </div>
            )}
          </For>

          {/* Phase 12: Category chips in dashboard */}
          <div class="ml-auto flex items-center gap-1.5">
            <For each={visibleCategoryCards()}>
              {(card) => <CategorySummaryChip value={card.value} label={card.label} />}
            </For>
          </div>
        </div>

        <Show when={currentState === 'empty'}>
          <p class="mt-2 text-center text-[13px] text-slate-500">
            {t(keys.dashboard.alertIndicators.empty)}
          </p>
        </Show>
      </div>
    )
  }

  return (
    <section class="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-[14px] font-semibold text-slate-900">
          {t(keys.dashboard.alertIndicators.title)}
        </h2>
      </header>
      {renderBody(state())}
    </section>
  )
}
