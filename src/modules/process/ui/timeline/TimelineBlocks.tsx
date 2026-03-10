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
    // For current leg: only show route when both origin AND destination are known
    // (destination is null when voyage is ongoing; we show destinationLine instead)
    if (!b.origin && !b.destination) return null
    if (props.isCurrent && !b.destination) return null
    return t(keys.shipmentView.timeline.blocks.voyageRoute, {
      origin: b.origin ?? '?',
      destination: b.destination ?? '?',
    })
  }

  /** Destination line for the current leg: "→ Santos · ETA 13/03" */
  const destinationLine = () => {
    if (!props.isCurrent) return null
    const events = props.block.events

    // Prefer confirmed destination (when DISCHARGE ACTUAL exists)
    let dest = props.block.destination
    let etaIso: string | null = null

    if (!dest) {
      // Fall back: pick destination from the last EXPECTED ARRIVAL event
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i]
        if (ev.type === 'ARRIVAL' && ev.eventTimeType === 'EXPECTED') {
          dest = ev.location ?? null
          etaIso = ev.eventTimeIso
          break
        }
      }
    }

    if (!dest) return null

    // If ETA not found yet, prefer EXPECTED ARRIVAL or EXPECTED DISCHARGE events only.
    // Avoid picking unrelated EXPECTED events (e.g., DEPARTURE) as ETA when destination
    // is already known from actuals.
    if (!etaIso) {
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i]
        if (
          ev.eventTimeType === 'EXPECTED' &&
          ev.eventTimeIso &&
          (ev.type === 'ARRIVAL' || ev.type === 'DISCHARGE')
        ) {
          etaIso = ev.eventTimeIso
          break
        }
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
    <div class="rounded-t border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2.5">
      <div class="flex items-center gap-2">
        {/* Ship icon */}
        <span class="text-xs shrink-0 opacity-70" aria-hidden="true">
          🚢
        </span>
        <span class="text-sm-ui font-semibold text-[var(--text-primary)] tracking-tight">
          {props.block.vessel ?? t(keys.shipmentView.timeline.blocks.voyage)}
        </span>
        <Show when={props.isCurrent}>
          <span class="inline-flex items-center rounded-md bg-[var(--status-info-bg)] px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider text-[var(--status-info-text)] ring-1 ring-inset ring-[var(--status-info-border)]">
            {t(keys.shipmentView.timeline.blocks.currentLeg)}
          </span>
        </Show>
      </div>
      <Show when={props.block.voyage}>
        {(voyage) => (
          <p class="mt-1 text-micro font-medium text-[var(--text-tertiary)]">
            {t(keys.shipmentView.timeline.blocks.voyage)} {voyage()}
          </p>
        )}
      </Show>
      <Show when={route()}>
        {(routeStr) => <p class="mt-0.5 text-micro text-[var(--text-tertiary)]">{routeStr()}</p>}
      </Show>
      <Show when={destinationLine()}>
        {(line) => <p class="mt-0.5 text-micro font-semibold text-[var(--status-info-text)]">{line()}</p>}
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
    <div class="rounded-t border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2.5">
      <div class="flex items-center gap-2">
        <span class="text-sm shrink-0" aria-hidden="true">
          {icon()}
        </span>
        <span class="text-sm-ui font-semibold text-[var(--text-secondary)] tracking-tight">{title()}</span>
      </div>
      <Show when={props.block.location}>
        {(loc) => <p class="mt-0.5 text-micro text-[var(--text-tertiary)]">{loc()}</p>}
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
    <div class="rounded-lg border-l-4 border-[var(--status-warning-icon)] bg-[var(--status-warning-bg)] px-3 py-2.5">
      <div class="flex items-center gap-2">
        <span class="text-sm" aria-hidden="true">
          🔁
        </span>
        <span class="text-sm-ui font-semibold text-[var(--status-warning-text)] tracking-tight">
          {t(keys.shipmentView.timeline.blocks.transshipment)}
        </span>
      </div>
      <Show when={props.block.port}>
        {(port) => <p class="mt-1 text-micro font-medium text-[var(--status-warning-text)]">{port()}</p>}
      </Show>
      <Show
        when={hasVesselChange()}
        fallback={
          <Show when={props.block.reason}>
            {(reason) => <p class="mt-0.5 text-micro text-[var(--status-warning-text)]">{reason()}</p>}
          </Show>
        }
      >
        <div class="mt-1.5 flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1 text-micro ring-1 ring-inset ring-[var(--border-default)]">
          <span class="text-[var(--text-secondary)] font-semibold shrink-0" aria-hidden="true">
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
    <div class="flex items-center py-2 pl-3">
      <div class="flex w-3 shrink-0 flex-col items-center">
        <div class="h-px w-px" />
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-muted)] px-2.5 py-1 text-micro italic text-[var(--text-muted)] ring-1 ring-inset ring-[var(--border-default)]">
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
        return 'border-[var(--status-warning-icon)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
      case 'warning':
        return 'border-[var(--status-warning-icon)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
      default:
        return 'border-[var(--border-strong)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
    }
  }

  const icon = () => (props.marker.severity === 'danger' ? '⚠' : '⏳')

  return (
    <div class="flex items-center gap-2 py-1.5 pl-3">
      {/* Timeline spine continuation */}
      <div class="flex w-3 shrink-0 flex-col items-center">
        <div class="h-px w-px" />
      </div>
      <div
        class={`flex items-center gap-1.5 rounded-md border-l-[3px] px-2 py-1 ${severityClasses()}`}
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
      return 'rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] shadow-[var(--card-shadow)]'
    }
    return props.variant === 'voyage'
      ? 'rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]'
      : 'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]'
  }

  return <div class={baseClass()}>{props.children}</div>
}

/**
 * Micro-separator between event rows inside a block (Phase 24).
 */
export function EventSeparator(): JSX.Element {
  return <div class="ml-3 border-t border-[var(--border-subtle)]" />
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
        return 'h-3 w-3 bg-[var(--status-info-icon)] ring-2 ring-[var(--status-info-border)] shadow-[0_0_4px_var(--status-info-icon)]'
      case 'voyage':
        return 'h-2.5 w-2.5 bg-[var(--status-info-icon)] ring-2 ring-[var(--bg-surface)]'
      case 'terminal':
        return 'h-2 w-2 bg-[var(--text-muted)] ring-2 ring-[var(--bg-surface)]'
      case 'transshipment':
        return 'h-3 w-3 bg-[var(--status-warning-icon)] ring-2 ring-[var(--bg-surface)]'
      case 'gap':
        return 'h-1.5 w-1.5 bg-[var(--border-strong)] ring-1 ring-[var(--bg-surface)]'
      case 'risk':
        return 'h-2 w-2 bg-[var(--status-warning-icon)] ring-1 ring-[var(--bg-surface)]'
      case 'event':
        return 'h-2 w-2 bg-[var(--status-success-icon)] ring-1 ring-[var(--bg-surface)]'
    }
  }

  return (
    <div
      class={`absolute top-3 -left-3 -translate-x-1/2 rounded-full z-10 ${cls()}`}
      aria-hidden="true"
    />
  )
}
