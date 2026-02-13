import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { ObservationResponse } from '~/shared/api-schemas/processes.schemas'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type Props = {
  readonly series: readonly ObservationResponse[]
  readonly activityLabel: string
  readonly isOpen: boolean
  readonly onClose: () => void
}

export function PredictionHistoryModal(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()

  // Calculate delta in days between consecutive EXPECTED observations
  const calculateDelta = (current: string, previous: string | null): number | null => {
    if (!previous) return null
    try {
      const currentDate = new Date(current)
      const previousDate = new Date(previous)
      const diffMs = currentDate.getTime() - previousDate.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      return diffDays
    } catch {
      return null
    }
  }

  // Determine badge for each observation
  const getBadge = (
    obs: ObservationResponse,
    index: number,
  ): { label: string; class: string } | null => {
    if (obs.event_time_type === 'ACTUAL') {
      return {
        label: t(keys.shipmentView.timeline.predictionHistory.confirmed),
        class: 'bg-emerald-100 text-emerald-700',
      }
    }

    // Check if it's expired (event_time < now and not the last one)
    const now = new Date()
    if (obs.event_time && new Date(obs.event_time) < now && index < props.series.length - 1) {
      return {
        label: t(keys.shipmentView.timeline.predictionHistory.expired),
        class: 'bg-amber-100 text-amber-700',
      }
    }

    // Last one or future expected
    if (index === props.series.length - 1 && obs.event_time_type === 'EXPECTED') {
      return {
        label: t(keys.shipmentView.timeline.predictionHistory.active),
        class: 'bg-blue-100 text-blue-700',
      }
    }

    return null
  }

  return (
    <Show when={props.isOpen}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click to close is standard modal pattern */}
      <div
        role="presentation"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => props.onClose()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose()
        }}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: click propagation handling, keyboard handled on parent */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="prediction-history-title"
          class="relative w-full max-w-2xl max-h-[80vh] overflow-auto bg-white rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h3 id="prediction-history-title" class="text-lg font-semibold text-slate-900">
              {t(keys.shipmentView.timeline.predictionHistory.title)} — {props.activityLabel}
            </h3>
            <button
              type="button"
              onClick={() => props.onClose()}
              class="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={t(keys.shipmentView.timeline.predictionHistory.close)}
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>{t(keys.shipmentView.timeline.predictionHistory.close)}</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div class="px-6 py-4">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      {t(keys.shipmentView.timeline.predictionHistory.eventType)}
                    </th>
                    <th
                      scope="col"
                      class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      {t(keys.shipmentView.timeline.predictionHistory.eventTime)}
                    </th>
                    <th
                      scope="col"
                      class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      {t(keys.shipmentView.timeline.predictionHistory.observedAt)}
                    </th>
                    <th
                      scope="col"
                      class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      {t(keys.shipmentView.timeline.predictionHistory.delta)}
                    </th>
                    <th scope="col" class="px-4 py-3" />
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  <For each={props.series}>
                    {(obs, getIndex) => {
                      const currentIndex = createMemo(() => getIndex())
                      const prevObs = createMemo(() =>
                        currentIndex() > 0 ? props.series[currentIndex() - 1] : null,
                      )
                      const delta = createMemo(() => {
                        const prev = prevObs()
                        if (!obs.event_time || !prev?.event_time) return null
                        return calculateDelta(obs.event_time, prev.event_time)
                      })
                      const badge = createMemo(() => getBadge(obs, currentIndex()))

                      return (
                        <tr class="hover:bg-slate-50">
                          <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                            <span
                              class={clsx(
                                'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                                obs.event_time_type === 'ACTUAL'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600',
                              )}
                            >
                              {obs.event_time_type === 'ACTUAL'
                                ? t(keys.shipmentView.timeline.actual)
                                : t(keys.shipmentView.timeline.expected)}
                            </span>
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                            {obs.event_time ? formatDateForLocale(obs.event_time, locale()) : '—'}
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                            {formatDateForLocale(obs.created_at, locale())}
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                            <Show when={delta() !== null && delta() !== 0}>
                              {(deltaValue) => (
                                <span
                                  class={clsx(
                                    'inline-flex items-center',
                                    deltaValue() > 0 ? 'text-red-600' : 'text-green-600',
                                  )}
                                >
                                  {deltaValue() > 0 ? '+' : ''}
                                  {deltaValue()}{' '}
                                  {t(keys.shipmentView.timeline.predictionHistory.days)}
                                </span>
                              )}
                            </Show>
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <Show when={badge()}>
                              {(badgeData) => (
                                <span
                                  class={clsx(
                                    'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                                    badgeData().class,
                                  )}
                                >
                                  {badgeData().label}
                                </span>
                              )}
                            </Show>
                          </td>
                        </tr>
                      )
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div class="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end">
            <button
              type="button"
              onClick={() => props.onClose()}
              class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              {t(keys.shipmentView.timeline.predictionHistory.close)}
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
