import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { PredictionHistoryModal } from '~/modules/process/ui/components/PredictionHistoryModal'
import type { TrackingTimelineItem } from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import { carrierTrackUrl } from '~/shared/utils/carrier'
import { copyToClipboard } from '~/shared/utils/clipboard'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

export function TimelineNode(props: {
  readonly event: TrackingTimelineItem
  readonly isLast: boolean
  readonly carrier?: string | null
  readonly containerNumber?: string | null
}): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const [showPredictionHistory, setShowPredictionHistory] = createSignal(false)

  const isoTooltip = (iso?: string | null): string | undefined => {
    if (!iso) return undefined
    // capture up to seconds: YYYY-MM-DDTHH:MM:SS
    const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
    if (m) return m[1]
    // fallback: strip milliseconds and trailing Z/offset
    return iso.replace(/\.\d+Z?$/, '').replace(/Z$/, '')
  }

  const isExpected = () => props.event.eventTimeType === 'EXPECTED'
  const isExpiredExpected = () => props.event.derivedState === 'EXPIRED_EXPECTED'

  const status = createMemo<EventStatus>(() => {
    if (!isExpected()) return 'completed'
    return isExpiredExpected() ? 'delayed' : 'expected'
  })

  const styles = createMemo((): { dot: string; line: string; text: string } => {
    switch (status()) {
      case 'completed':
        return {
          dot: 'bg-emerald-500 border-emerald-500',
          line: 'bg-emerald-500',
          text: 'text-slate-900',
        }
      case 'current':
        return {
          dot: 'bg-blue-500 border-blue-500 ring-4 ring-blue-100',
          line: 'bg-slate-200',
          text: 'text-slate-900 font-medium',
        }
      case 'delayed':
        return {
          dot: 'bg-red-500 border-red-500 ring-4 ring-red-100',
          line: 'bg-slate-200',
          text: 'text-red-700 font-medium',
        }
      default:
        return {
          dot: 'bg-white border-slate-300 border-2',
          line: 'bg-slate-200',
          text: 'text-slate-500',
        }
    }
  })

  const href = createMemo(() => {
    const trackUrl = carrierTrackUrl(props.carrier ?? null, props.containerNumber ?? '')
    return typeof trackUrl === 'string' ? trackUrl : undefined
  })

  function typeToLabel(type: TrackingTimelineItem['type']): string {
    switch (type) {
      case 'SYSTEM_CREATED':
        return t(keys.shipmentView.timeline.systemCreated)
      case 'GATE_IN':
        return t(keys.tracking.observationType.GATE_IN)
      case 'GATE_OUT':
        return t(keys.tracking.observationType.GATE_OUT)
      case 'LOAD':
        return t(keys.tracking.observationType.LOAD)
      case 'DEPARTURE':
        return t(keys.tracking.observationType.DEPARTURE)
      case 'ARRIVAL':
        return t(keys.tracking.observationType.ARRIVAL)
      case 'DISCHARGE':
        return t(keys.tracking.observationType.DISCHARGE)
      case 'DELIVERY':
        return t(keys.tracking.observationType.DELIVERY)
      case 'EMPTY_RETURN':
        return t(keys.tracking.observationType.EMPTY_RETURN)
      case 'CUSTOMS_HOLD':
        return t(keys.tracking.observationType.CUSTOMS_HOLD)
      case 'CUSTOMS_RELEASE':
        return t(keys.tracking.observationType.CUSTOMS_RELEASE)
      default:
        return t(keys.tracking.observationType.OTHER)
    }
  }

  const label = createMemo(() => {
    let s = typeToLabel(props.event.type)
    if (props.event.vesselName) {
      s += ` — ${props.event.vesselName}`
      if (props.event.voyage) s += ` (${props.event.voyage})`
    }
    return s
  })

  const dateIso = createMemo(() =>
    props.event.eventTimeType === 'ACTUAL' ? props.event.eventTimeIso : null,
  )
  const expectedDateIso = createMemo(() =>
    props.event.eventTimeType === 'EXPECTED' ? props.event.eventTimeIso : null,
  )

  return (
    <>
      <div
        class={clsx('flex items-start gap-6', {
          'opacity-60': isExpected() && !isExpiredExpected(),
          'opacity-40': isExpiredExpected(),
        })}
      >
        {/* Timeline node and connector */}
        <div class="flex flex-col items-center">
          <div class={`h-3 w-3 rounded-full ${styles().dot}`} />
          <Show when={!props.isLast}>
            <div class={`w-0.5 flex-1 min-h-12 ${styles().line}`} />
          </Show>
        </div>

        {/* Event content */}
        <div class="flex-1 pb-6">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <p class={`text-sm ${styles().text}`}>{label()}</p>

                {/* Info icon for prediction history */}
                <Show when={props.event.series && props.event.series.length > 1}>
                  <button
                    type="button"
                    onClick={() => setShowPredictionHistory(true)}
                    class="inline-flex items-center justify-center h-5 w-5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title={t(keys.shipmentView.timeline.viewPredictionHistory)}
                    aria-label={t(keys.shipmentView.timeline.viewPredictionHistory)}
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <title>{t(keys.shipmentView.timeline.viewPredictionHistory)}</title>
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </Show>

                {/* Badge for EXPECTED events */}
                <Show when={isExpiredExpected()}>
                  <span
                    class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"
                    title={t(keys.shipmentView.timeline.expiredExpectedTooltip)}
                  >
                    {t(keys.shipmentView.timeline.expiredExpected)}
                  </span>
                </Show>
                <Show when={isExpected() && !isExpiredExpected()}>
                  <span
                    class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600"
                    title={t(keys.shipmentView.timeline.predictedTooltip)}
                  >
                    {t(keys.shipmentView.timeline.expected)}
                  </span>
                </Show>
              </div>

              <Show when={props.event.location}>
                <p class="text-xs text-slate-500 mt-0.5">{props.event.location}</p>
              </Show>
            </div>

            <div class="text-right">
              <div class="flex items-center justify-end gap-2">
                <Show
                  when={dateIso()}
                  fallback={
                    <Show when={expectedDateIso()}>
                      {(expectedDateIso) => (
                        <p
                          class="text-xs text-slate-400"
                          title={isoTooltip(expectedDateIso() ?? undefined)}
                        >
                          {t(keys.shipmentView.timeline.expected)}{' '}
                          {expectedDateIso()
                            ? formatDateForLocale(expectedDateIso(), locale())
                            : null}
                        </p>
                      )}
                    </Show>
                  }
                >
                  {(dateIso) => (
                    <p class="text-xs text-slate-600" title={isoTooltip(dateIso() ?? undefined)}>
                      <span class="sr-only">{t(keys.shipmentView.timeline.actual)}</span>
                      {dateIso() ? formatDateForLocale(dateIso(), locale()) : null}
                    </p>
                  )}
                </Show>

                {/* Small neutral badge linking to carrier tracking (rarely used) */}
                <Show when={href()}>
                  <a
                    href={href()}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t(keys.shipmentView.timeline.viewOnCarrierSite)}
                    class="ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                    onClick={(e) => {
                      e.preventDefault()
                      void (async () => {
                        try {
                          if (props.containerNumber) await copyToClipboard(props.containerNumber)
                        } catch {
                          /* ignore */
                        } finally {
                          try {
                            const h = href()
                            if (typeof h === 'string') window.open(h, '_blank')
                          } catch {
                            /* ignore */
                          }
                        }
                      })()
                    }}
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <title>{t(keys.shipmentView.timeline.viewOnCarrierSite)}</title>
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
                      />
                    </svg>
                  </a>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prediction History Modal */}
      <Show when={props.event.series}>
        {(series) => (
          <PredictionHistoryModal
            series={series()}
            activityLabel={label()}
            isOpen={showPredictionHistory()}
            onClose={() => setShowPredictionHistory(false)}
          />
        )}
      </Show>
    </>
  )
}
