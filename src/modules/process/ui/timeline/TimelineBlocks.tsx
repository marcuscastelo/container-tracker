import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type {
  GapMarker,
  PortRiskMarker,
  TerminalBlock,
  TransshipmentBlock,
  VoyageBlock,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

// ---------------------------------------------------------------------------
// Phase 20 — Voyage Block Header ("Identity Card")
// ---------------------------------------------------------------------------

export function VoyageBlockHeader(props: {
  readonly block: VoyageBlock
  readonly isCurrent?: boolean
}): JSX.Element {
  const { t, keys, locale } = useTranslation()

  const route = () => {
    const b = props.block
    if (!b.origin && !b.destination) return null
    return t(keys.shipmentView.timeline.blocks.voyageRoute, {
      origin: b.origin ?? '?',
      destination: b.destination ?? '?',
    })
  }

  /** Destination line for the current leg: "→ Santos · ETA 13/03" */
  const destinationLine = () => {
    if (!props.isCurrent) return null
    const dest = props.block.destination
    if (!dest) return null
    // Try to find the last event with an ETA in this voyage block
    const events = props.block.events
    let etaIso: string | null = null
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev.eventTimeType === 'EXPECTED' && ev.eventTimeIso) {
        etaIso = ev.eventTimeIso
        break
      }
    }
    if (etaIso) {
      return t(keys.shipmentView.timeline.blocks.destinationEta, {
        destination: dest,
        eta: formatDateForLocale(etaIso, locale()),
      })
    }
    return t(keys.shipmentView.timeline.blocks.destinationNoEta, { destination: dest })
  }

  return (
    <div class="rounded-t border-b border-slate-200/50 bg-gradient-to-r from-slate-50/80 to-white px-2.5 py-2">
      <div class="flex items-center gap-1.5">
        {/* Ship icon */}
        <span class="text-sm shrink-0" aria-hidden="true">
          🚢
        </span>
        <span class="text-md-ui font-semibold text-slate-800 tracking-tight">
          {props.block.vessel ?? t(keys.shipmentView.timeline.blocks.voyage)}
        </span>
        <Show when={props.isCurrent}>
          <span class="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-px text-micro font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200">
            {t(keys.shipmentView.timeline.blocks.currentLeg)}
          </span>
        </Show>
      </div>
      <Show when={props.block.voyage}>
        {(voyage) => (
          <p class="mt-0.5 text-micro font-medium text-slate-500">
            {t(keys.shipmentView.timeline.blocks.voyage)} {voyage()}
          </p>
        )}
      </Show>
      <Show when={route()}>
        {(routeStr) => <p class="mt-0.5 text-micro text-slate-500">{routeStr()}</p>}
      </Show>
      <Show when={destinationLine()}>
        {(line) => <p class="mt-0.5 text-micro font-semibold text-blue-600">{line()}</p>}
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

  const icon = () => {
    switch (props.block.kind) {
      case 'pre-carriage':
        return '🚚'
      case 'transshipment-terminal':
        return '🔁'
      default:
        return '🏗'
    }
  }

  return (
    <div class="rounded-t border-b border-slate-100 bg-slate-50/30 px-2.5 py-2">
      <div class="flex items-center gap-1.5">
        <span class="text-sm shrink-0" aria-hidden="true">
          {icon()}
        </span>
        <span class="text-sm-ui font-semibold text-slate-600 tracking-tight">{title()}</span>
      </div>
      <Show when={props.block.location}>
        {(loc) => <p class="mt-0.5 text-micro text-slate-400">{loc()}</p>}
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
    <div class="rounded-md border-l-4 border-amber-400 bg-amber-50/80 px-2.5 py-2">
      <div class="flex items-center gap-1.5">
        <span class="text-sm" aria-hidden="true">
          🔁
        </span>
        <span class="text-sm-ui font-bold text-amber-900 tracking-tight">
          {t(keys.shipmentView.timeline.blocks.transshipment)}
        </span>
      </div>
      <Show when={props.block.port}>
        {(port) => <p class="mt-0.5 text-micro font-medium text-amber-800">{port()}</p>}
      </Show>
      <Show
        when={hasVesselChange()}
        fallback={
          <Show when={props.block.reason}>
            {(reason) => <p class="mt-0.5 text-micro text-amber-700">{reason()}</p>}
          </Show>
        }
      >
        <div class="mt-1 flex items-center gap-1 rounded bg-amber-100/60 px-2 py-0.5 text-micro">
          <span class="font-semibold text-amber-900 truncate">{props.block.fromVessel ?? '?'}</span>
          <span class="text-amber-600 shrink-0" aria-hidden="true">
            →
          </span>
          <span class="font-semibold text-amber-900 truncate">{props.block.toVessel ?? '?'}</span>
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
    <div class="flex items-center py-1.5 pl-3">
      <div class="flex w-3 shrink-0 flex-col items-center">
        <div class="h-px w-px" />
      </div>
      <span class="inline-flex items-center gap-1 rounded-full bg-slate-50/80 px-2 py-0.5 text-micro italic text-slate-400 ring-1 ring-slate-100/80">
        ⏳ {label()}
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
        return 'border-amber-500 bg-amber-50 text-amber-900'
      case 'warning':
        return 'border-amber-400 bg-amber-50/60 text-amber-800'
      default:
        return 'border-slate-300 bg-slate-50 text-slate-600'
    }
  }

  const icon = () => (props.marker.severity === 'danger' ? '⚠' : '⏳')

  return (
    <div class="flex items-center gap-1.5 py-1 pl-3">
      {/* Timeline spine continuation */}
      <div class="flex w-3 shrink-0 flex-col items-center">
        <div class="h-px w-px" />
      </div>
      <div
        class={`flex items-center gap-1 rounded border-l-[3px] px-1.5 py-0.5 ${severityClasses()}`}
      >
        <span class="text-micro" aria-hidden="true">
          {icon()}
        </span>
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
      return 'rounded-lg border border-blue-200 bg-blue-50/30 shadow-[0_1px_3px_rgba(59,130,246,0.08)] ring-1 ring-blue-100/60'
    }
    return props.variant === 'voyage'
      ? 'rounded-lg border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
      : 'rounded-lg border border-slate-100 bg-white'
  }

  return <div class={baseClass()}>{props.children}</div>
}

/**
 * Micro-separator between event rows inside a block (Phase 24).
 */
export function EventSeparator(): JSX.Element {
  return <div class="ml-3 border-t border-slate-50" />
}

// ---------------------------------------------------------------------------
// Continuous Rail — Visual connector between timeline blocks
// ---------------------------------------------------------------------------

export type RailDotVariant =
  | 'voyage'
  | 'terminal'
  | 'transshipment'
  | 'gap'
  | 'risk'
  | 'event'
  | 'current-voyage'

/**
 * A dot marker positioned on the outer timeline rail.
 * When placed inside a `relative` wrapper at `pl-5` from the rail container,
 * the dot centers on the rail line at `left: 8px`.
 */
export function RailDot(props: { readonly variant: RailDotVariant }): JSX.Element {
  const cls = (): string => {
    switch (props.variant) {
      case 'current-voyage':
        return 'h-3 w-3 bg-blue-500 ring-2 ring-blue-200 shadow-[0_0_4px_rgba(59,130,246,0.4)]'
      case 'voyage':
        return 'h-2.5 w-2.5 bg-blue-400 ring-2 ring-white'
      case 'terminal':
        return 'h-2 w-2 bg-slate-400 ring-2 ring-white'
      case 'transshipment':
        return 'h-3 w-3 bg-amber-400 ring-2 ring-white'
      case 'gap':
        return 'h-1.5 w-1.5 bg-slate-300 ring-1 ring-white'
      case 'risk':
        return 'h-2 w-2 bg-amber-400 ring-1 ring-white'
      case 'event':
        return 'h-2 w-2 bg-emerald-400 ring-1 ring-white'
    }
  }

  return (
    <div
      class={`absolute top-3 -left-3 -translate-x-1/2 rounded-full z-10 ${cls()}`}
      aria-hidden="true"
    />
  )
}
