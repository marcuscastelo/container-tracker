import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import {
  seriesLabelToClass,
  seriesLabelToKey,
} from '~/modules/process/ui/mappers/seriesLabel.ui-mapper'
import type { TrackingSeriesHistoryItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
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

function calculateDelta(current: string, previous: string | null): number | null {
  if (!previous) return null

  const currentDate = new Date(current)
  const previousDate = new Date(previous)

  const currentTime = currentDate.getTime()
  const previousTime = previousDate.getTime()

  if (Number.isNaN(currentTime) || Number.isNaN(previousTime)) {
    return null
  }

  const diffMs = currentTime - previousTime
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function PredictionHistoryRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const isActual = () => props.observation.event_time_type === 'ACTUAL'
  const hasDelta = () => props.deltaDays !== null && props.deltaDays !== 0
  const deltaPrefix = () => (props.deltaDays !== null && props.deltaDays > 0 ? '+' : '')

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
        <Show when={hasDelta()} fallback="—">
          <span
            class={clsx(
              'inline-flex items-center',
              (props.deltaDays ?? 0) > 0 ? 'text-tone-danger-fg' : 'text-tone-success-fg',
            )}
          >
            {deltaPrefix()}
            {props.deltaDays} {t(keys.shipmentView.timeline.predictionHistory.days)}
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
