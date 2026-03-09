import clsx from 'clsx'
import { createMemo, type JSX, Show } from 'solid-js'

type Props = {
  readonly isLast: boolean
  readonly isExpected: boolean
  readonly isExpiredExpected: boolean
  readonly highlighted: boolean

  readonly dotClass: string
  readonly lineClass: string
  readonly textClass: string

  readonly label: string
  readonly eventIconPath?: string

  readonly nonMappedBadgeLabel?: string

  readonly showPredictionHistoryButton: boolean
  readonly onOpenPredictionHistory: () => void
  readonly predictionHistoryLabel: string

  readonly expiredExpectedLabel: string
  readonly expiredExpectedTooltip: string
  readonly expectedLabel?: string
  readonly predictedTooltip?: string

  readonly etaChipLabel?: string | null
  readonly location?: string | null

  readonly dateLabel: JSX.Element | null
  readonly carrierLink: JSX.Element | null
}

export function TimelineNodeLayout(props: Props): JSX.Element {
  const isFuture = createMemo(() => props.isExpected && !props.isExpiredExpected)

  const showInlineEta = createMemo(() => props.etaChipLabel && !isFuture())
  const showEtaBelow = createMemo(() => props.etaChipLabel && isFuture())
  const showLocation = createMemo(() => !showEtaBelow() && props.location)

  return (
    <div
      class={clsx('flex items-start gap-1.5 sm:gap-2 rounded-sm px-1 py-0.5', {
        'opacity-70': isFuture(),
        'opacity-35': props.isExpiredExpected,
        'bg-amber-50/60': props.highlighted && !props.isExpected,
      })}
    >
      {/* Minimal status dot — no vertical line; outer rail handles continuity */}
      <div class="flex shrink-0 items-center pt-[5px]">
        <div
          class={clsx('shrink-0 rounded-full', props.dotClass, {
            'h-1.5 w-1.5 border border-dashed border-slate-300': props.isExpected,
            'h-[5px] w-[5px]': !props.isExpected,
          })}
        />
      </div>

      {/* Content */}
      <div class="min-w-0 flex-1 pb-0.5">
        <div class="flex items-start justify-between gap-1.5">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1">
              <Show when={props.eventIconPath}>
                {(eventIconPath) => (
                  <svg
                    class={`h-3.5 w-3.5 shrink-0 ${props.textClass}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d={eventIconPath()}
                    />
                  </svg>
                )}
              </Show>

              <Show when={showInlineEta() && props.etaChipLabel}>
                {(etaChipLabel) => <EtaChip label={etaChipLabel()} />}
              </Show>

              <p class={`text-sm-ui leading-tight ${props.textClass}`}>{props.label}</p>

              <Show when={props.showPredictionHistoryButton}>
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
              </Show>

              <Show when={props.nonMappedBadgeLabel}>
                {(nonMappedBadgeLabel) => (
                  <span
                    class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1 py-px text-micro font-medium leading-none text-slate-500"
                    title={nonMappedBadgeLabel()}
                  >
                    {nonMappedBadgeLabel()}
                  </span>
                )}
              </Show>

              <Show when={props.isExpiredExpected}>
                <span
                  class="inline-flex items-center rounded bg-amber-50 px-1 py-px text-micro font-medium text-amber-600"
                  title={props.expiredExpectedTooltip}
                >
                  {props.expiredExpectedLabel}
                </span>
              </Show>
            </div>

            <Show when={showEtaBelow() && props.etaChipLabel}>
              {(etaChipLabel) => (
                <div class="mt-px">
                  <EtaChip label={etaChipLabel()} />
                </div>
              )}
            </Show>

            <Show when={showLocation()}>
              {(location) => (
                <p class="mt-px text-micro leading-tight text-gray-500 truncate">{location()}</p>
              )}
            </Show>
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

function EtaChip(props: { label: string }) {
  return (
    <span class="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-px text-micro font-semibold text-blue-700 border border-blue-200">
      <span aria-hidden="true">🟦</span>
      {props.label}
    </span>
  )
}
