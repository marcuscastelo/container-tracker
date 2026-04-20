import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { DashboardChartWindowSize } from '~/modules/process/ui/fetchDashboardProcessesCreatedByMonth'
import type { DashboardMonthlyBarDatumVM } from '~/modules/process/ui/viewmodels/dashboard-monthly-bar-datum.vm'
import { useTranslation } from '~/shared/localization/i18n'

type DashboardActivityChartCardProps = {
  readonly data: readonly DashboardMonthlyBarDatumVM[]
  readonly loading: boolean
  readonly refreshing?: boolean
  readonly hasError: boolean
  readonly windowSize: DashboardChartWindowSize
}

function toMonthTooltipLabel(monthKey: string, locale: string): string {
  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthKey
  }

  const date = new Date(Date.UTC(year, month - 1, 1))
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function toSkeletonIndexes(windowSize: DashboardChartWindowSize): readonly number[] {
  return Array.from({ length: windowSize }, (_, index) => index)
}

function ChartSkeleton(props: { readonly windowSize: DashboardChartWindowSize }): JSX.Element {
  return (
    <div class="space-y-3">
      <div class="h-3 w-28 animate-pulse rounded bg-surface-muted" />
      <div
        class="grid h-36 items-end gap-1.5 sm:gap-2.5"
        style={{ 'grid-template-columns': `repeat(${props.windowSize}, minmax(0, 1fr))` }}
      >
        <For each={toSkeletonIndexes(props.windowSize)}>
          {(index) => {
            const percent = Math.max(10, Math.round(((index + 1) / props.windowSize) * 100))
            return (
              <div class="flex flex-col items-center gap-1">
                <div
                  class="w-full animate-pulse rounded-md bg-surface-muted"
                  style={{ height: `${percent}%` }}
                />
                <div class="h-2 w-6 animate-pulse rounded bg-surface-muted" />
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

type ChartBarsProps = {
  readonly data: readonly DashboardMonthlyBarDatumVM[]
  readonly locale: string
  readonly formatProcessCount: (count: number) => string
}

type ChartBarItemProps = {
  readonly datum: DashboardMonthlyBarDatumVM
  readonly locale: string
  readonly yearMilestoneLabel: string | null
  readonly formatProcessCount: (count: number) => string
  readonly barHeight: string
}

function toYearFromMonthKey(monthKey: string): number | null {
  const [yearPart] = monthKey.split('-')
  const year = Number(yearPart)
  if (!Number.isInteger(year)) {
    return null
  }
  return year
}

function toYearMilestoneLabel(
  data: readonly DashboardMonthlyBarDatumVM[],
  index: number,
): string | null {
  const current = data[index]
  if (current === undefined) return null

  const currentYear = toYearFromMonthKey(current.key)
  if (currentYear === null) return null
  if (index === 0) return String(currentYear)

  const previous = data[index - 1]
  if (previous === undefined) return String(currentYear)

  const previousYear = toYearFromMonthKey(previous.key)
  if (previousYear === null || previousYear !== currentYear) {
    return String(currentYear)
  }

  return null
}

function ChartBarItem(props: ChartBarItemProps): JSX.Element {
  return (
    <div class="flex min-w-0 flex-col items-center gap-1">
      <span class="text-[11px] font-medium tabular-nums text-text-muted">{props.datum.value}</span>
      <div class="relative h-28 w-full overflow-hidden rounded-md border border-border/70 bg-surface-muted/70">
        <div
          class="absolute inset-x-0 bottom-0 rounded-t-sm bg-primary"
          style={{ height: props.barHeight }}
          title={`${toMonthTooltipLabel(props.datum.key, props.locale)}\n${props.formatProcessCount(props.datum.value)}`}
        />
      </div>
      <div class="flex min-h-8 flex-col items-center justify-start">
        <span class="truncate text-xs-ui font-medium text-text-muted" title={props.datum.label}>
          {props.datum.label}
        </span>
        <Show when={props.yearMilestoneLabel}>
          {(year) => <span class="text-[10px] leading-tight text-text-muted/85">{year()}</span>}
        </Show>
      </div>
    </div>
  )
}

function ChartBars(props: ChartBarsProps): JSX.Element {
  const maxValue = () => {
    if (props.data.length === 0) return 0

    let currentMax = 0
    for (const datum of props.data) {
      if (datum.value > currentMax) {
        currentMax = datum.value
      }
    }

    return currentMax
  }

  const toBarHeight = (value: number): string => {
    const highest = maxValue()
    if (highest <= 0) {
      return '0%'
    }

    const ratio = (value / highest) * 100
    return `${Math.max(0, Math.min(100, ratio))}%`
  }

  return (
    <div class="space-y-3">
      <div
        class="grid h-40 items-end gap-1.5 sm:gap-2.5"
        style={{ 'grid-template-columns': `repeat(${props.data.length}, minmax(0, 1fr))` }}
      >
        <For each={props.data}>
          {(datum, index) => (
            <ChartBarItem
              datum={datum}
              locale={props.locale}
              yearMilestoneLabel={toYearMilestoneLabel(props.data, index())}
              formatProcessCount={props.formatProcessCount}
              barHeight={toBarHeight(datum.value)}
            />
          )}
        </For>
      </div>
    </div>
  )
}

function ChartErrorState(props: { readonly message: string }): JSX.Element {
  return <div class="py-10 text-center text-md-ui text-tone-danger-fg">{props.message}</div>
}

function ChartEmptyState(props: { readonly message: string }): JSX.Element {
  return <div class="py-10 text-center text-md-ui text-text-muted">{props.message}</div>
}

export function DashboardActivityChartCard(props: DashboardActivityChartCardProps): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const formatProcessCount = (count: number): string =>
    t(keys.dashboard.activityChart.tooltip.processes, { count })

  return (
    <section
      class="mb-4 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0_/8%)]"
      aria-busy={props.loading || props.refreshing === true}
    >
      <header class="border-b border-border px-6 py-4">
        <h2 class="text-lg-ui font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {t(keys.dashboard.activityChart.title)}
        </h2>
        <p class="mt-1 text-sm-ui text-text-muted">
          {t(keys.dashboard.activityChart.subtitleLastMonths, { count: props.windowSize })}
        </p>
      </header>

      <div class="px-4 py-4 sm:px-6">
        <Show when={!props.loading} fallback={<ChartSkeleton windowSize={props.windowSize} />}>
          <Show
            when={!props.hasError}
            fallback={<ChartErrorState message={t(keys.dashboard.activityChart.error)} />}
          >
            <Show
              when={props.data.length > 0}
              fallback={<ChartEmptyState message={t(keys.dashboard.activityChart.empty)} />}
            >
              <ChartBars
                data={props.data}
                locale={locale()}
                formatProcessCount={formatProcessCount}
              />
            </Show>
          </Show>
        </Show>
      </div>
    </section>
  )
}
