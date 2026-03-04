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
  readonly nonMappedBadgeLabel?: string
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
      class={clsx('flex items-start gap-2.5 sm:gap-3', {
        'opacity-50': props.isExpected && !props.isExpiredExpected,
        'opacity-35': props.isExpiredExpected,
      })}
    >
      {/* Vertical rail: dot + connecting line */}
      <div class="flex flex-col items-center pt-[5px] w-3 shrink-0">
        <div
          class={clsx('shrink-0 rounded-full', props.dotClass, {
            'h-1.5 w-1.5': props.isExpected,
            'h-[7px] w-[7px]': !props.isExpected,
          })}
        />
        {props.isLast ? null : <div class={`w-px flex-1 min-h-8 ${props.lineClass}`} />}
      </div>

      {/* Content area */}
      <div class="min-w-0 flex-1 pb-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1">
              <p class={`text-[12px] leading-tight ${props.textClass}`}>{props.label}</p>

              {props.showPredictionHistoryButton ? (
                <button
                  type="button"
                  onClick={() => props.onOpenPredictionHistory()}
                  class="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-500"
                  title={props.predictionHistoryLabel}
                  aria-label={props.predictionHistoryLabel}
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              {props.nonMappedBadgeLabel ? (
                <span
                  class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1 py-px text-[9px] font-medium leading-none text-slate-500"
                  title={props.nonMappedBadgeLabel}
                >
                  {props.nonMappedBadgeLabel}
                </span>
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
                  class="inline-flex items-center rounded border border-dashed border-slate-200 bg-transparent px-1 py-px text-[9px] font-medium text-slate-400"
                  title={props.predictedTooltip}
                >
                  {props.expectedLabel}
                </span>
              ) : null}
            </div>

            {props.location ? (
              <p class="mt-px text-[10px] leading-tight text-slate-400 truncate">
                {props.location}
              </p>
            ) : null}
          </div>

          <div class="shrink-0 text-right">
            <div class="flex items-center justify-end gap-0.5">
              {props.dateLabel}
              {props.carrierLink}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
