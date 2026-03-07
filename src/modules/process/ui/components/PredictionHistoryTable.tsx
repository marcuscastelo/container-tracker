import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import {
  seriesLabelToClass,
  seriesLabelToKey,
} from '~/modules/process/ui/mappers/seriesLabel.ui-mapper'
import type { classifyTrackingSeries } from '~/modules/tracking/application/projection/tracking.series.classification'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type ClassifiedObservation = ReturnType<typeof classifyTrackingSeries>['classified'][number]

type Props = {
  readonly classified: readonly ClassifiedObservation[]
  readonly locale: string
}

type RowProps = {
  readonly observation: ClassifiedObservation
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
    <tr class="hover:bg-slate-50">
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-slate-900">
        <span
          class={clsx(
            'inline-flex items-center rounded px-2 py-0.5 text-xs-ui font-medium',
            isActual() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
          )}
        >
          {isActual()
            ? t(keys.shipmentView.timeline.actual)
            : t(keys.shipmentView.timeline.expected)}
        </span>
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-slate-600">
        {props.observation.event_time
          ? formatDateForLocale(props.observation.event_time, props.locale)
          : '—'}
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-slate-600">
        {formatDateForLocale(props.observation.created_at, props.locale)}
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm-ui text-slate-600">
        <Show when={hasDelta()} fallback="—">
          <span
            class={clsx(
              'inline-flex items-center',
              (props.deltaDays ?? 0) > 0 ? 'text-red-600' : 'text-green-600',
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
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-slate-500"
            >
              {t(keys.shipmentView.timeline.predictionHistory.eventType)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-slate-500"
            >
              {t(keys.shipmentView.timeline.predictionHistory.eventTime)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-slate-500"
            >
              {t(keys.shipmentView.timeline.predictionHistory.observedAt)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-slate-500"
            >
              {t(keys.shipmentView.timeline.predictionHistory.delta)}
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs-ui font-medium uppercase tracking-wider text-slate-500"
            >
              {t(keys.shipmentView.timeline.predictionHistory.status)}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 bg-white">
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
