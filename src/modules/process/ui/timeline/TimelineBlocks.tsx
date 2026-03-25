import { Construction, Hourglass, Repeat, Ship, TriangleAlert, Truck } from 'lucide-solid'
import { type JSX, Match, Show, Switch } from 'solid-js'
import type {
  GapMarker,
  PortRiskMarker,
  TerminalBlock,
  TransshipmentBlock,
  VoyageBlock,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import { useTranslation } from '~/shared/localization/i18n'

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

export function TransshipmentBlockCard(props: { readonly block: TransshipmentBlock }): JSX.Element {
  const { t, keys } = useTranslation()

  const hasVesselChange = () => Boolean(props.block.fromVessel || props.block.toVessel)

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
        when={hasVesselChange()}
        fallback={
          <Show when={props.block.reason}>
            {(reason) => <p class="mt-0.5 text-micro text-tone-warning-fg">{reason()}</p>}
          </Show>
        }
      >
        <div class="mt-1 flex items-center gap-1 rounded bg-tone-warning-border/50 px-2 py-0.5 text-micro">
          <span class="text-tone-warning-fg font-semibold shrink-0" aria-hidden="true">
            {t(keys.shipmentView.timeline.blocks.vesselChangeDetail, {
              from: props.block.fromVessel ?? '?',
              to: props.block.toVessel ?? '?',
            })}
          </span>
        </div>
      </Show>
    </div>
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
