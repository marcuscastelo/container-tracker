import clsx from 'clsx'
import type { JSX } from 'solid-js'

type Props = {
  readonly isLast: boolean
  readonly isExpected: boolean
  readonly isExpiredExpected: boolean
  readonly dotClass: string
  readonly lineClass: string
  readonly textClass: string
  readonly label: string
  readonly showPredictionHistoryButton: boolean
  readonly onOpenPredictionHistory: () => void
  readonly predictionHistoryLabel: string
  readonly expiredExpectedLabel: string
  readonly expiredExpectedTooltip: string
  readonly expectedLabel: string
  readonly predictedTooltip: string
  readonly location?: string | null
  readonly dateLabel: JSX.Element | null
  readonly carrierLink: JSX.Element | null
}

export function TimelineNodeLayout(props: Props): JSX.Element {
  return (
    <div
      class={clsx('flex items-start gap-6', {
        'opacity-60': props.isExpected && !props.isExpiredExpected,
        'opacity-40': props.isExpiredExpected,
      })}
    >
      <div class="flex flex-col items-center">
        <div class={`h-3 w-3 rounded-full ${props.dotClass}`} />
        {props.isLast ? null : <div class={`min-h-12 w-0.5 flex-1 ${props.lineClass}`} />}
      </div>

      <div class="flex-1 pb-6">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <p class={`text-sm ${props.textClass}`}>{props.label}</p>

              {props.showPredictionHistoryButton ? (
                <button
                  type="button"
                  onClick={() => props.onOpenPredictionHistory()}
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title={props.predictionHistoryLabel}
                  aria-label={props.predictionHistoryLabel}
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <title>{props.predictionHistoryLabel}</title>
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              ) : null}

              {props.isExpiredExpected ? (
                <span
                  class="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700"
                  title={props.expiredExpectedTooltip}
                >
                  {props.expiredExpectedLabel}
                </span>
              ) : null}

              {props.isExpected && !props.isExpiredExpected ? (
                <span
                  class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600"
                  title={props.predictedTooltip}
                >
                  {props.expectedLabel}
                </span>
              ) : null}
            </div>

            {props.location ? <p class="mt-0.5 text-xs text-slate-500">{props.location}</p> : null}
          </div>

          <div class="text-right">
            <div class="flex items-center justify-end gap-2">
              {props.dateLabel}
              {props.carrierLink}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
