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
      class={clsx('flex items-start gap-3 sm:gap-4', {
        'opacity-60': props.isExpected && !props.isExpiredExpected,
        'opacity-40': props.isExpiredExpected,
      })}
    >
      <div class="flex flex-col items-center pt-0.5">
        <div class={`h-2 w-2 shrink-0 rounded-full ${props.dotClass}`} />
        {props.isLast ? null : <div class={`min-h-10 w-px flex-1 ${props.lineClass}`} />}
      </div>

      <div class="min-w-0 flex-1 pb-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <p class={`text-[13px] leading-tight ${props.textClass}`}>{props.label}</p>

              {props.showPredictionHistoryButton ? (
                <button
                  type="button"
                  onClick={() => props.onOpenPredictionHistory()}
                  class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-500"
                  title={props.predictionHistoryLabel}
                  aria-label={props.predictionHistoryLabel}
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  class="inline-flex items-center rounded bg-amber-50 px-1 py-px text-[9px] font-medium text-amber-600"
                  title={props.expiredExpectedTooltip}
                >
                  {props.expiredExpectedLabel}
                </span>
              ) : null}

              {props.isExpected && !props.isExpiredExpected ? (
                <span
                  class="inline-flex items-center rounded border border-slate-200 bg-transparent px-1 py-px text-[9px] font-medium text-slate-400"
                  title={props.predictedTooltip}
                >
                  {props.expectedLabel}
                </span>
              ) : null}
            </div>

            {props.location ? (
              <p class="mt-px text-[11px] leading-tight text-slate-400">{props.location}</p>
            ) : null}
          </div>

          <div class="shrink-0 text-right">
            <div class="flex items-center justify-end gap-1">
              {props.dateLabel}
              {props.carrierLink}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
