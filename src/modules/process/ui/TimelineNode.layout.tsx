import clsx from 'clsx'
import { EyeIcon, TriangleAlert } from 'lucide-solid'
import { createMemo, type JSX, Show } from 'solid-js'
import { toTimelineNodeAttentionDisplay } from '~/modules/process/ui/components/timeline-node.presenter'

type Props = {
  readonly isLast: boolean
  readonly isExpected: boolean
  readonly isExpiredExpected: boolean
  readonly hasSeriesConflict: boolean

  readonly dotClass: string
  readonly lineClass: string
  readonly textClass: string

  readonly label: string
  readonly eventIcon?: JSX.Element

  readonly nonMappedBadgeLabel?: string

  readonly showPredictionHistoryButton: boolean
  readonly onOpenPredictionHistory: () => void
  readonly predictionHistoryLabel: string
  readonly showObservationButton?: boolean
  readonly onOpenObservation?: () => void
  readonly observationLabel?: string

  readonly conflictBadgeLabel: string
  readonly conflictTooltip: string
  readonly expiredExpectedLabel: string
  readonly expiredExpectedTooltip: string
  readonly expectedLabel?: string
  readonly predictedTooltip?: string
  readonly emptyContainerBadgeLabel?: string

  readonly etaChipLabel?: string | null
  readonly location?: string | null

  readonly dateLabel: JSX.Element | null
  readonly carrierLink: JSX.Element | null
}

export function TimelineNodeLayout(props: Props): JSX.Element {
  const isFuture = createMemo(() => props.isExpected && !props.isExpiredExpected)
  const attentionDisplay = createMemo(() =>
    toTimelineNodeAttentionDisplay({
      hasSeriesConflict: props.hasSeriesConflict,
    }),
  )

  const showInlineEta = createMemo(() => props.etaChipLabel && !isFuture())
  const showEtaBelow = createMemo(() => props.etaChipLabel && isFuture())
  const showLocation = createMemo(() => !showEtaBelow() && props.location)

  return (
    <div
      class={clsx('flex items-stretch gap-3 rounded-md px-1 py-1', attentionDisplay().rowClass, {
        'opacity-70': isFuture(),
        'opacity-45': props.isExpiredExpected,
      })}
    >
      <div class="flex w-10 shrink-0 flex-col items-center">
        <div
          class={clsx(
            'flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
            props.dotClass,
            attentionDisplay().dotAccentClass,
          )}
        >
          <Show
            when={props.eventIcon}
            fallback={<span class="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />}
          >
            {(eventIcon) => eventIcon()}
          </Show>
        </div>

        <Show when={!props.isLast}>
          <div class={clsx('mt-1 w-px flex-1 rounded-full', props.lineClass)} />
        </Show>
      </div>

      <div class="min-w-0 flex-1 pb-1">
        <div class="flex items-start justify-between gap-2.5">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <p class={`text-sm-ui leading-tight ${props.textClass}`}>{props.label}</p>

              <Show when={attentionDisplay().showConflictBadge}>
                <span
                  class="inline-flex items-center gap-1 rounded border border-tone-warning-border bg-tone-warning-bg/70 px-1 py-px text-micro font-medium leading-none text-tone-warning-fg"
                  title={props.conflictTooltip}
                >
                  <TriangleAlert class="h-3 w-3 shrink-0" aria-hidden="true" />
                  {props.conflictBadgeLabel}
                </span>
              </Show>

              <Show when={showInlineEta() && props.etaChipLabel}>
                {(etaChipLabel) => <EtaChip label={etaChipLabel()} />}
              </Show>

              <Show when={props.showPredictionHistoryButton}>
                <button
                  type="button"
                  onClick={() => props.onOpenPredictionHistory()}
                  class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-tone-info-bg hover:text-tone-info-strong"
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
                    class="inline-flex items-center rounded border border-border bg-surface-muted px-1 py-px text-micro font-medium leading-none text-text-muted"
                    title={nonMappedBadgeLabel()}
                  >
                    {nonMappedBadgeLabel()}
                  </span>
                )}
              </Show>

              <Show when={props.emptyContainerBadgeLabel}>
                {(emptyContainerBadgeLabel) => (
                  <span class="inline-flex items-center rounded border border-tone-warning-border bg-tone-warning-bg px-1 py-px text-micro font-medium leading-none text-tone-warning-fg">
                    {emptyContainerBadgeLabel()}
                  </span>
                )}
              </Show>

              <Show when={props.isExpiredExpected}>
                <span
                  class="inline-flex items-center rounded bg-tone-warning-bg px-1 py-px text-micro font-medium text-tone-warning-fg"
                  title={props.expiredExpectedTooltip}
                >
                  {props.expiredExpectedLabel}
                </span>
              </Show>

              <Show when={props.showObservationButton}>
                <button
                  type="button"
                  onClick={() => props.onOpenObservation?.()}
                  class="inline-flex items-center  rounded border border-border bg-surface px-1 py-px text-micro font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground text-xs"
                >
                  <span title={props.observationLabel}>
                    <EyeIcon width={12} height={12} class="ml-0.5" aria-hidden="true" />
                  </span>
                </button>
              </Show>
            </div>

            <Show when={showEtaBelow() && props.etaChipLabel}>
              {(etaChipLabel) => (
                <div class="mt-1">
                  <EtaChip label={etaChipLabel()} />
                </div>
              )}
            </Show>

            <Show when={showLocation()}>
              {(location) => (
                <p class="mt-0.5 text-xs-ui leading-tight text-text-muted">{location()}</p>
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
    <span class="inline-flex items-center gap-0.5 rounded border border-tone-info-border bg-tone-info-bg px-1 py-px text-micro font-semibold text-tone-info-fg">
      <svg class="h-2.5 w-2.5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="3" />
      </svg>
      {props.label}
    </span>
  )
}
