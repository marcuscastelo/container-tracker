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

// ---------------------------------------------------------------------------
// Phase 20 — Voyage Block Header ("Identity Card")
// ---------------------------------------------------------------------------

export function VoyageBlockHeader(props: { readonly block: VoyageBlock }): JSX.Element {
  const { t, keys } = useTranslation()

  const route = () => {
    const b = props.block
    if (!b.origin && !b.destination) return null
    return t(keys.shipmentView.timeline.blocks.voyageRoute, {
      origin: b.origin ?? '?',
      destination: b.destination ?? '?',
    })
  }

  return (
    <div class="mb-1 rounded-t border-b border-slate-100/70 bg-slate-50/60 px-2 py-1.5">
      <div class="flex items-center gap-1.5">
        {/* Ship icon */}
        <span class="text-sm shrink-0" aria-hidden="true">
          🚢
        </span>
        <span class="text-[13px] font-semibold text-slate-900">
          {props.block.vessel ?? t(keys.shipmentView.timeline.blocks.voyage)}
        </span>
      </div>
      <Show when={props.block.voyage}>
        {(voyage) => (
          <p class="mt-0.5 text-[10px] font-medium text-slate-500">
            {t(keys.shipmentView.timeline.blocks.voyage)} {voyage()}
          </p>
        )}
      </Show>
      <Show when={route()}>
        {(routeStr) => <p class="mt-0.5 text-[10px] text-slate-500">{routeStr()}</p>}
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
    <div class="mb-1 rounded-t border-b border-slate-100/60 bg-white/80 px-2 py-1.5">
      <div class="flex items-center gap-1.5">
        <span class="text-sm shrink-0" aria-hidden="true">
          {icon()}
        </span>
        <span class="text-[12px] font-medium text-slate-600">{title()}</span>
      </div>
      <Show when={props.block.location}>
        {(loc) => <p class="mt-0.5 text-[10px] text-slate-400">{loc()}</p>}
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 22 — Transshipment Block
// ---------------------------------------------------------------------------

export function TransshipmentBlockCard(props: { readonly block: TransshipmentBlock }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="my-1 rounded border-l-4 border-amber-400 bg-amber-50 px-2.5 py-1.5">
      <div class="flex items-center gap-1.5">
        <span class="text-sm" aria-hidden="true">
          🔁
        </span>
        <span class="text-[12px] font-semibold text-amber-900">
          {t(keys.shipmentView.timeline.blocks.transshipment)}
        </span>
      </div>
      <Show when={props.block.port}>
        {(port) => <p class="mt-0.5 text-[10px] font-medium text-amber-800">{port()}</p>}
      </Show>
      <Show when={props.block.reason}>
        {(reason) => <p class="mt-0.5 text-[10px] text-amber-700">{reason()}</p>}
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
    <div class="flex items-center gap-1.5 py-0.5 pl-3">
      {/* Timeline spine continuation (thin dot for the marker) */}
      <div class="flex w-3 shrink-0 flex-col items-center">
        <div class="h-px w-px" />
      </div>
      <p class="text-[10px] italic text-slate-600">⏳ {label()}</p>
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
    <div class="flex items-center gap-1.5 py-0.5 pl-3">
      {/* Timeline spine continuation */}
      <div class="flex w-3 shrink-0 flex-col items-center">
        <div class="h-px w-px" />
      </div>
      <div
        class={`flex items-center gap-1 rounded border-l-[3px] px-1.5 py-0.5 ${severityClasses()}`}
      >
        <span class="text-[10px]" aria-hidden="true">
          {icon()}
        </span>
        <p class="text-[10px] font-medium">{label()}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 7 — Block Wrapper (Card Container)
// ---------------------------------------------------------------------------

/**
 * Wraps block content in a styled card. VoyageBlocks use a subtle card;
 * TerminalBlocks use a neutral card.
 */
export function BlockCard(props: {
  readonly variant: 'voyage' | 'terminal'
  readonly children: JSX.Element
}): JSX.Element {
  const baseClass = () =>
    props.variant === 'voyage'
      ? 'rounded border border-slate-200/60 bg-slate-50/40 mb-1.5'
      : 'rounded border border-slate-100/80 bg-white mb-1.5'

  return <div class={baseClass()}>{props.children}</div>
}

/**
 * Micro-separator between event rows inside a block (Phase 24).
 */
export function EventSeparator(): JSX.Element {
  return <div class="ml-3 border-t border-slate-50" />
}
