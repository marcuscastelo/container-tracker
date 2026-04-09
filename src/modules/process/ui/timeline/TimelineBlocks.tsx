import { Construction, EyeIcon, Hourglass, Repeat, Ship, TriangleAlert, Truck } from 'lucide-solid'
import { createEffect, createMemo, createSignal, type JSX, Match, Show, Switch } from 'solid-js'
import { CarrierLinkButton } from '~/modules/process/ui/components/CarrierLinkButton'
import { ObservationInspector } from '~/modules/process/ui/components/ObservationInspector'
import { fetchObservationInspector } from '~/modules/process/ui/fetchProcessTrackingDetails'
import type {
  GapMarker,
  PortRiskMarker,
  TerminalBlock,
  TransshipmentBlock,
  VoyageBlock,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import type { ContainerObservationVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import type { TemporalValueDto } from '~/shared/time/dto'
import { carrierTrackUrl } from '~/shared/utils/carrier'
import { formatDateForLocale } from '~/shared/utils/formatDate'

// ---------------------------------------------------------------------------
// Phase 20 — Voyage Block Header ("Identity Card")
// ---------------------------------------------------------------------------

export function VoyageBlockHeader(props: {
  readonly block: VoyageBlock
  readonly isCurrent?: boolean
}): JSX.Element {
  const { t, keys } = useTranslation()

  const route = () => {
    const b = props.block
    let origin = b.origin
    let destination = b.destination

    if (!origin) {
      for (const ev of b.events) {
        if (ev.location && (ev.type === 'LOAD' || ev.type === 'DEPARTURE')) {
          origin = ev.location
          break
        }
      }
    }

    if (!destination) {
      for (let i = b.events.length - 1; i >= 0; i--) {
        const ev = b.events[i]
        if (!ev) continue
        if (ev.type === 'ARRIVAL' && ev.eventTimeType === 'EXPECTED' && ev.location) {
          destination = ev.location
          break
        }
      }
    }

    if (!destination) {
      for (let i = b.events.length - 1; i >= 0; i--) {
        const ev = b.events[i]
        if (!ev) continue
        if (ev.type === 'DISCHARGE' && ev.eventTimeType === 'EXPECTED' && ev.location) {
          destination = ev.location
          break
        }
      }
    }

    if (!destination) {
      for (let i = b.events.length - 1; i >= 0; i--) {
        const ev = b.events[i]
        if (!ev) continue
        if (ev.location && (ev.type === 'ARRIVAL' || ev.type === 'DISCHARGE')) {
          destination = ev.location
          break
        }
      }
    }

    if (!origin && !destination) return null
    return t(keys.shipmentView.timeline.blocks.voyageRoute, {
      origin: origin ?? '?',
      destination: destination ?? '?',
    })
  }

  return (
    <div class="rounded-t-xl border-b border-border/70 bg-surface-muted px-3 py-2.5">
      <div class="flex items-center gap-1.5">
        {/* Ship icon */}
        <Ship class="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
        <span class="text-sm-ui font-bold text-foreground tracking-tight">
          {props.block.vessel ?? t(keys.shipmentView.timeline.blocks.voyage)}
        </span>
        <Show when={props.isCurrent}>
          <span class="inline-flex items-center rounded-full bg-tone-info-bg px-1.5 py-px text-micro font-bold uppercase tracking-wider text-tone-info-fg ring-1 ring-tone-info-border">
            {t(keys.shipmentView.timeline.blocks.currentLeg)}
          </span>
        </Show>
      </div>
      <Show when={props.block.voyage}>
        {(voyage) => (
          <p class="mt-0.5 text-micro font-medium text-text-muted">
            {t(keys.shipmentView.timeline.blocks.voyage)} {voyage()}
          </p>
        )}
      </Show>
      <Show when={route()}>
        {(routeStr) => (
          <p
            class={`mt-0.5 text-micro ${props.isCurrent ? 'font-semibold text-tone-info-fg' : 'text-text-muted'}`}
          >
            {routeStr()}
          </p>
        )}
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 21 — Terminal Block Header ("Identity Card")
// ---------------------------------------------------------------------------

export function TerminalBlockHeader(props: { readonly block: TerminalBlock }): JSX.Element {
  const { t, keys } = useTranslation()

  const title = () => {
    switch (props.block.kind) {
      case 'pre-carriage':
        return t(keys.shipmentView.timeline.blocks.preCarriage)
      case 'transshipment-terminal':
        return t(keys.shipmentView.timeline.blocks.transshipmentTerminal)
      case 'post-carriage':
        return t(keys.shipmentView.timeline.blocks.postCarriage)
      default:
        return t(keys.shipmentView.timeline.blocks.terminalInland)
    }
  }

  const Icon = () => (
    <Switch fallback={<Construction class="w-4 h-4 shrink-0" aria-hidden="true" />}>
      <Match when={props.block.kind === 'pre-carriage'}>
        <Truck class="w-4 h-4 shrink-0" aria-hidden="true" />
      </Match>
      <Match when={props.block.kind === 'transshipment-terminal'}>
        <Repeat class="w-4 h-4 shrink-0" aria-hidden="true" />
      </Match>
    </Switch>
  )

  return (
    <div class="rounded-t-xl border-b border-border/70 bg-surface-muted/70 px-3 py-2.5">
      <div class="flex items-center gap-1.5">
        <Icon />
        <span class="text-sm-ui font-semibold text-foreground tracking-tight">{title()}</span>
      </div>
      <Show when={props.block.location}>
        {(loc) => <p class="mt-0.5 text-micro text-text-muted">{loc()}</p>}
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 22 — Transshipment Block
// ---------------------------------------------------------------------------

type TransshipmentBlockCardProps = {
  readonly block: TransshipmentBlock
  readonly containerId: string | null | undefined
  readonly carrier: string | null | undefined
  readonly containerNumber: string | null | undefined
}

type InlineCarrierLinkProps = {
  readonly href: string | undefined
  readonly containerNumber: string | null | undefined
  readonly label: string
}

function InlineCarrierLinkButton(props: InlineCarrierLinkProps): JSX.Element | null {
  return <CarrierLinkButton {...props} class="transition-colors" />
}

function ObservationButton(props: {
  readonly label: string
  readonly onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      title={props.label}
      aria-label={props.label}
      class="inline-flex items-center rounded border border-border bg-surface px-1 py-px text-micro font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground text-xs"
    >
      <span class="sr-only">{props.label}</span>
      <EyeIcon width={12} height={12} class="ml-0.5" aria-hidden="true" />
    </button>
  )
}

function PlannedDateLabel(props: {
  readonly eventTime: TemporalValueDto | null
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly locale: string
  readonly expectedLabel: string
  readonly actualLabel: string
}): JSX.Element | null {
  return (
    <Show when={props.eventTime}>
      {(eventTime) => (
        <div class="flex flex-col items-end" title={eventTime().value}>
          <span class="tabular-nums text-sm-ui font-medium text-foreground">
            {formatDateForLocale(eventTime(), props.locale)}
          </span>
          <span class="mt-0.5 text-micro leading-tight text-text-muted">
            {props.eventTimeType === 'EXPECTED' ? props.expectedLabel : props.actualLabel}
          </span>
        </div>
      )}
    </Show>
  )
}

function transshipmentHandoffLabel(
  block: TransshipmentBlock,
  translate: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string | null {
  if (block.handoffDisplayMode === 'FULL') {
    return translate(keys.shipmentView.timeline.blocks.vesselChangeDetail, {
      from: block.previousVesselName ?? '?',
      to: block.nextVesselName ?? '?',
    })
  }

  if (block.handoffDisplayMode === 'NEXT_ONLY' && block.nextVesselName !== null) {
    return translate(keys.shipmentView.timeline.blocks.vesselChangeNextOnly, {
      to: block.nextVesselName,
    })
  }

  return null
}

function PlannedTransshipmentBlockCard(props: TransshipmentBlockCardProps): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const representativeEvent = createMemo<TrackingTimelineItem | null>(() => {
    const lastIndex = props.block.events.length - 1
    const event = lastIndex >= 0 ? props.block.events[lastIndex] : undefined
    return event ?? null
  })
  const handoffLabel = createMemo(() => transshipmentHandoffLabel(props.block, t, keys))
  const carrierHref = createMemo(() => {
    const trackUrl = carrierTrackUrl(props.carrier ?? null, props.containerNumber ?? '')
    return typeof trackUrl === 'string' ? trackUrl : undefined
  })

  const [showObservationInspector, setShowObservationInspector] = createSignal(false)
  const [observation, setObservation] = createSignal<ContainerObservationVM | null>(null)
  const [observationLoading, setObservationLoading] = createSignal(false)
  const [observationErrorMessage, setObservationErrorMessage] = createSignal<string | null>(null)

  createEffect(() => {
    representativeEvent()?.id
    setShowObservationInspector(false)
    setObservation(null)
    setObservationLoading(false)
    setObservationErrorMessage(null)
  })

  const canOpenObservation = createMemo(() => {
    const event = representativeEvent()
    return (
      event !== null &&
      typeof event.observationId === 'string' &&
      props.containerId !== null &&
      props.containerId !== undefined
    )
  })

  const openObservationInspector = async (): Promise<void> => {
    const event = representativeEvent()
    const containerId = props.containerId

    setShowObservationInspector(true)
    setObservationErrorMessage(null)

    if (
      event === null ||
      typeof event.observationId !== 'string' ||
      containerId === null ||
      containerId === undefined ||
      observation() !== null
    ) {
      return
    }

    setObservationLoading(true)
    try {
      const loadedObservation = await fetchObservationInspector(containerId, event.observationId)
      setObservation(loadedObservation)
    } catch (error) {
      console.error(`Failed to load observation ${event.observationId}:`, error)
      setObservationErrorMessage(t(keys.shipmentView.loadError))
    } finally {
      setObservationLoading(false)
    }
  }

  return (
    <>
      <div class="rounded-xl border border-border bg-surface-muted/80 px-3 py-2.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <Repeat class="w-4 h-4 shrink-0 text-tone-warning-fg" aria-hidden="true" />
              <span class="text-sm-ui font-semibold text-foreground tracking-tight">
                {t(keys.shipmentView.timeline.blocks.plannedTransshipment)}
              </span>
              <Show when={canOpenObservation()}>
                <ObservationButton
                  label={t(keys.shipmentView.timeline.viewObservation)}
                  onClick={() => {
                    void openObservationInspector()
                  }}
                />
              </Show>
            </div>
            <Show when={props.block.port}>
              {(port) => <p class="mt-0.5 text-micro font-medium text-text-muted">{port()}</p>}
            </Show>
            <Show
              when={handoffLabel()}
              fallback={
                <Show when={props.block.reason}>
                  {(reason) => <p class="mt-1 text-micro text-text-muted">{reason()}</p>}
                </Show>
              }
            >
              {(label) => (
                <div class="mt-1 inline-flex items-center rounded border border-tone-warning-border/70 bg-tone-warning-bg/45 px-2 py-0.5 text-micro font-medium text-tone-warning-fg">
                  {label()}
                </div>
              )}
            </Show>
          </div>

          <div class="shrink-0 text-right">
            <div class="flex items-center justify-end gap-0.5">
              <Show when={representativeEvent()}>
                {(event) => (
                  <PlannedDateLabel
                    eventTime={event().eventTime}
                    eventTimeType={event().eventTimeType}
                    locale={locale()}
                    expectedLabel={t(keys.shipmentView.timeline.expected).toLowerCase()}
                    actualLabel={t(keys.shipmentView.timeline.actual)}
                  />
                )}
              </Show>
              <InlineCarrierLinkButton
                href={carrierHref()}
                containerNumber={props.containerNumber}
                label={t(keys.shipmentView.timeline.viewOnCarrierSite)}
              />
            </div>
          </div>
        </div>
      </div>

      <ObservationInspector
        observation={observation()}
        isOpen={showObservationInspector()}
        loading={observationLoading()}
        errorMessage={observationErrorMessage()}
        onClose={() => setShowObservationInspector(false)}
      />
    </>
  )
}

function ConfirmedTransshipmentBlockCard(props: TransshipmentBlockCardProps): JSX.Element {
  const { t, keys } = useTranslation()

  const handoffLabel = createMemo(() => transshipmentHandoffLabel(props.block, t, keys))

  return (
    <div class="rounded-xl border border-tone-warning-border bg-tone-warning-bg px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0_/8%)]">
      <div class="flex items-center gap-1.5">
        <Repeat class="w-4 h-4 shrink-0" aria-hidden="true" />
        <span class="text-sm-ui font-bold text-tone-warning-fg tracking-tight">
          {t(keys.shipmentView.timeline.blocks.transshipment)}
        </span>
      </div>
      <Show when={props.block.port}>
        {(port) => <p class="mt-0.5 text-micro font-medium text-tone-warning-fg">{port()}</p>}
      </Show>
      <Show
        when={handoffLabel()}
        fallback={
          <Show when={props.block.reason}>
            {(reason) => <p class="mt-0.5 text-micro text-tone-warning-fg">{reason()}</p>}
          </Show>
        }
      >
        <div class="mt-1 flex items-center gap-1 rounded bg-tone-warning-border/50 px-2 py-0.5 text-micro">
          <span class="text-tone-warning-fg font-semibold shrink-0">{handoffLabel()}</span>
        </div>
      </Show>
    </div>
  )
}

export function TransshipmentBlockCard(props: TransshipmentBlockCardProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.block.mode === 'planned'}>
        <PlannedTransshipmentBlockCard {...props} />
      </Match>
      <Match when={true}>
        <ConfirmedTransshipmentBlockCard {...props} />
      </Match>
    </Switch>
  )
}

// ---------------------------------------------------------------------------
// Phase 13-14 — Gap Marker Row
// ---------------------------------------------------------------------------

export function GapMarkerRow(props: { readonly marker: GapMarker }): JSX.Element {
  const { t, keys } = useTranslation()

  const label = () => {
    if (props.marker.kind === 'transit') {
      return t(keys.shipmentView.timeline.blocks.gapTransit, {
        days: props.marker.durationDays,
      })
    }
    return t(keys.shipmentView.timeline.blocks.gapGeneric, {
      days: props.marker.durationDays,
    })
  }

  return (
    <div class="py-1 pl-12">
      <span class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-micro italic text-text-muted ring-1 ring-border/80">
        <Hourglass class="w-3 h-3 shrink-0" aria-hidden="true" />
        {label()}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 16-18 — Port Risk Marker Row
// ---------------------------------------------------------------------------

export function PortRiskMarkerRow(props: { readonly marker: PortRiskMarker }): JSX.Element {
  const { t, keys } = useTranslation()

  const label = () => {
    if (props.marker.ongoing) {
      return t(keys.shipmentView.timeline.blocks.portRiskOngoing, {
        days: props.marker.durationDays,
      })
    }
    if (props.marker.severity === 'danger') {
      return t(keys.shipmentView.timeline.blocks.portRiskClosed, {
        days: props.marker.durationDays,
      })
    }
    return t(keys.shipmentView.timeline.blocks.portRiskShort, {
      days: props.marker.durationDays,
    })
  }

  const severityClasses = () => {
    switch (props.marker.severity) {
      case 'danger':
        return 'border-tone-warning-strong bg-tone-warning-bg text-tone-warning-fg'
      case 'warning':
        return 'border-tone-warning-border bg-tone-warning-bg/70 text-tone-warning-fg'
      default:
        return 'border-border bg-surface-muted text-text-muted'
    }
  }

  const Icon = () =>
    props.marker.severity === 'danger' ? (
      <TriangleAlert class="w-3 h-3 shrink-0" aria-hidden="true" />
    ) : (
      <Hourglass class="w-3 h-3 shrink-0" aria-hidden="true" />
    )

  return (
    <div class="py-1 pl-12">
      <div
        class={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${severityClasses()}`}
      >
        <Icon />
        <p class="text-micro font-medium">{label()}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 7 — Block Wrapper (Card Container)
// ---------------------------------------------------------------------------

/**
 * Wraps block content in a styled card. VoyageBlocks use a subtle card;
 * TerminalBlocks use a neutral card. Current-voyage gets a blue accent.
 */
export function BlockCard(props: {
  readonly variant: 'voyage' | 'terminal'
  readonly isCurrent?: boolean
  readonly children: JSX.Element
}): JSX.Element {
  const baseClass = () => {
    if (props.isCurrent) {
      return 'rounded-xl border border-tone-info-border bg-tone-info-bg/30 shadow-[0_1px_3px_rgb(0_0_0_/8%)] ring-1 ring-tone-info-border/50'
    }
    return props.variant === 'voyage'
      ? 'rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
      : 'rounded-xl border border-border/70 bg-surface-muted/40'
  }

  return <div class={baseClass()}>{props.children}</div>
}

/**
 * Micro-separator between event rows inside a block (Phase 24).
 */
export function EventSeparator(): JSX.Element {
  return <div class="ml-12 border-t border-border/60" />
}
