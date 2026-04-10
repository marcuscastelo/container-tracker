import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import {
  seriesLabelToClass,
  seriesLabelToKey,
} from '~/modules/process/ui/mappers/seriesLabel.ui-mapper'
import type { TrackingSeriesHistoryItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import { toComparableInstant } from '~/shared/time/compare-temporal'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValue } from '~/shared/time/parsing'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type Props = {
  readonly classified: readonly TrackingSeriesHistoryItem[]
  readonly locale: string
}

type RowProps = {
  readonly observation: TrackingSeriesHistoryItem
  readonly locale: string
  readonly deltaDays: number | null
}

const PREDICTION_DELTA_COMPARE_OPTIONS = {
  timezone: 'UTC',
  strategy: 'start-of-day',
} as const

type PredictionHistoryChangeDisplay = {
  readonly text: string
  readonly tone: 'neutral' | 'success' | 'danger' | 'warning'
}

function calculateDelta(
  current: TemporalValueDto,
  previous: TemporalValueDto | null,
): number | null {
  if (!previous) return null
  const currentTemporal = parseTemporalValue(current)
  const previousTemporal = parseTemporalValue(previous)

  if (!currentTemporal || !previousTemporal) {
    return null
  }

  const currentInstant = toComparableInstant(currentTemporal, PREDICTION_DELTA_COMPARE_OPTIONS)
  const previousInstant = toComparableInstant(previousTemporal, PREDICTION_DELTA_COMPARE_OPTIONS)
  const diffMs = currentInstant.diffMs(previousInstant)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function formatPredictionHistoryVoyageLabel(observation: TrackingSeriesHistoryItem): string {
  const vesselName = observation.vesselName?.trim() ?? ''
  const voyage = observation.voyage?.trim() ?? ''

  if (vesselName.length > 0 && voyage.length > 0) {
    return `${vesselName} / ${voyage}`
  }

  if (vesselName.length > 0) return vesselName
  if (voyage.length > 0) return voyage
  return '—'
}

export function resolvePredictionHistoryChangeDisplay(command: {
  readonly observation: TrackingSeriesHistoryItem
  readonly deltaDays: number | null
  readonly translateVoyageCorrection: () => string
  readonly translateDays: () => string
}): PredictionHistoryChangeDisplay {
  if (command.observation.changeKind === 'VOYAGE_CORRECTED_AFTER_CONFIRMATION') {
    return {
      text: command.translateVoyageCorrection(),
      tone: 'warning',
    }
  }

  if (command.deltaDays !== null && command.deltaDays !== 0) {
    return {
      text: `${command.deltaDays > 0 ? '+' : ''}${command.deltaDays} ${command.translateDays()}`,
      tone: command.deltaDays > 0 ? 'danger' : 'success',
    }
  }

  return {
    text: '—',
    tone: 'neutral',
  }
}

function PredictionHistoryRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const isActual = () => props.observation.event_time_type === 'ACTUAL'
  const changeDisplay = () =>
    resolvePredictionHistoryChangeDisplay({
      observation: props.observation,
      deltaDays: props.deltaDays,
      translateVoyageCorrection: () =>
        t(keys.shipmentView.timeline.predictionHistory.voyageCorrectedAfterConfirmation),
      translateDays: () => t(keys.shipmentView.timeline.predictionHistory.days),
    })
  const changeClass = () => {
    switch (changeDisplay().tone) {
      case 'warning':
        return 'text-tone-warning-fg'
      case 'danger':
        return 'text-tone-danger-fg'
      case 'success':
        return 'text-tone-success-fg'
      default:
        return 'text-text-muted'
    }
  }

  return (
    <tr class="hover:bg-surface-muted">
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-foreground">
        <span
          class={clsx(
            'inline-flex items-center rounded px-2 py-0.5 text-xs-ui font-medium',
            isActual()
              ? 'bg-tone-success-bg text-tone-success-fg'
              : 'bg-surface-muted text-text-muted',
          )}
        >
          {isActual()
            ? t(keys.shipmentView.timeline.actual)
            : t(keys.shipmentView.timeline.expected)}
        </span>
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-text-muted">
        {props.observation.event_time
          ? formatDateForLocale(props.observation.event_time, props.locale)
          : '—'}
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-text-muted">
        {formatDateForLocale(props.observation.created_at, props.locale)}
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-text-muted">
        {formatPredictionHistoryVoyageLabel(props.observation)}
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-text-muted">
        <Show when={changeDisplay().text !== '—'} fallback="—">
          <span class={clsx('inline-flex items-center', changeClass())}>
            {changeDisplay().text}
          </span>
        </Show>
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-right text-sm-ui">
        <span
          class={clsx(
            'inline-flex items-center rounded px-2 py-0.5 text-xs-ui font-medium',
            seriesLabelToClass(props.observation.seriesLabel),
          )}
        >
          {t(seriesLabelToKey(keys, props.observation.seriesLabel))}
        </span>
      </td>
    </tr>
  )
}

export function PredictionHistoryTable(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const rows = () =>
    props.classified.map((observation, index) => {
      const previous = index > 0 ? props.classified[index - 1] : null
      const deltaDays =
        observation.event_time && previous?.event_time
          ? calculateDelta(observation.event_time, previous.event_time)
          : null

      return {
        observation,
        deltaDays,
      }
    })

  return (
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-border">
        <thead class="bg-surface-muted">
          <tr>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-text-muted"
            >
              {t(keys.shipmentView.timeline.predictionHistory.eventType)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-text-muted"
            >
              {t(keys.shipmentView.timeline.predictionHistory.eventTime)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-text-muted"
            >
              {t(keys.shipmentView.timeline.predictionHistory.observedAt)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-text-muted"
            >
              {t(keys.shipmentView.timeline.predictionHistory.voyage)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-text-muted"
            >
              {t(keys.shipmentView.timeline.predictionHistory.delta)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-text-muted"
            >
              {t(keys.shipmentView.timeline.predictionHistory.status)}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border bg-surface">
          <For each={rows()}>
            {(row) => (
              <PredictionHistoryRow
                observation={row.observation}
                locale={props.locale}
                deltaDays={row.deltaDays}
              />
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}
