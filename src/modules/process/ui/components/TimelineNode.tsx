import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { TimelineEvent } from '~/modules/process/application/processPresenter'
import { useTranslation } from '~/shared/localization/i18n'
import { carrierTrackUrl } from '~/shared/utils/carrier'
import { copyToClipboard } from '~/shared/utils/clipboard'
import { formatDateForLocale } from '~/shared/utils/formatDate'

export function TimelineNode(props: {
  readonly event: TimelineEvent
  readonly isLast: boolean
  readonly carrier?: string | null
  readonly containerNumber?: string | null
}): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const isoTooltip = (iso?: string | null): string | undefined => {
    if (!iso) return undefined
    // capture up to seconds: YYYY-MM-DDTHH:MM:SS
    const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
    if (m) return m[1]
    // fallback: strip milliseconds and trailing Z/offset
    return iso.replace(/\.\d+Z?$/, '').replace(/Z$/, '')
  }
  const nodeStyles = (): { dot: string; line: string; text: string } => {
    switch (props.event.status) {
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
  }

  const styles = nodeStyles()
  const trackUrl = carrierTrackUrl(props.carrier ?? null, props.containerNumber ?? '')
  const href = typeof trackUrl === 'string' ? trackUrl : undefined

  // Determine if this is an EXPECTED event
  const isExpected = () => props.event.eventTimeType === 'EXPECTED'

  return (
    <div class={clsx('flex items-start gap-6', { 'opacity-60': isExpected() })}>
      {/* Timeline node and connector */}
      <div class="flex flex-col items-center">
        <div class={`h-3 w-3 rounded-full ${styles.dot}`} />
        <Show when={!props.isLast}>
          <div class={`w-0.5 flex-1 min-h-12 ${styles.line}`} />
        </Show>
      </div>

      {/* Event content */}
      <div class="flex-1 pb-6">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <p class={`text-sm ${styles.text}`}>{props.event.label}</p>
              {/* Badge for EXPECTED events */}
              <Show when={isExpected()}>
                <span
                  class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600"
                  title="This is a predicted event, not yet confirmed"
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
                when={props.event.date}
                fallback={
                  <Show when={props.event.expectedDate}>
                    <p
                      class="text-xs text-slate-400"
                      title={isoTooltip(props.event.expectedDate_iso ?? props.event.expectedDate)}
                    >
                      {t(keys.shipmentView.timeline.expected)}{' '}
                      {/* prefer ISO field so we reformat reactively */}
                      {props.event.expectedDate_iso
                        ? formatDateForLocale(props.event.expectedDate_iso, locale())
                        : props.event.expectedDate}
                    </p>
                  </Show>
                }
              >
                <p
                  class="text-xs text-slate-600"
                  title={isoTooltip(props.event.date_iso ?? props.event.date)}
                >
                  <span class="sr-only">{t(keys.shipmentView.timeline.actual)}</span>
                  {props.event.date_iso
                    ? formatDateForLocale(props.event.date_iso, locale())
                    : props.event.date}
                </p>
              </Show>
              {/* Small neutral badge linking to carrier tracking (rarely used) */}
              <Show when={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on carrier site"
                  class="ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                  onClick={async (e) => {
                    try {
                      e.preventDefault()
                      // copy container number to clipboard (best-effort)
                      if (props.containerNumber) await copyToClipboard(props.containerNumber)
                    } catch {
                      /* ignore */
                    } finally {
                      // open carrier link in new tab
                      try {
                        if (typeof href === 'string') window.open(href, '_blank')
                      } catch {
                        // ignore
                      }
                    }
                  }}
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <title>View on carrier site</title>
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
  )
}
