import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { TimelineNode } from '~/modules/process/ui/components/TimelineNode'
import type { NonMappedIndicatorVariant } from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  BlockCard,
  EventSeparator,
  GapMarkerRow,
  PortRiskMarkerRow,
  TerminalBlockHeader,
  TransshipmentBlockCard,
  VoyageBlockHeader,
} from '~/modules/process/ui/timeline/TimelineBlocks'
import {
  buildTimelineRenderList,
  type TimelineRenderItem,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  selectedContainer: ContainerDetailVM | null
  carrier?: string | null
  nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  alerts?: readonly AlertDisplayVM[]
}

/** Maps alert types to related observation type prefixes for visual linking */
function alertTypeToEventTypes(alertType: AlertDisplayVM['type']): readonly string[] {
  switch (alertType) {
    case 'transshipment':
      return ['DEPARTURE', 'ARRIVAL', 'LOAD', 'DISCHARGE']
    case 'delay':
      return ['ARRIVAL', 'DISCHARGE', 'DELIVERY']
    case 'customs':
      return ['CUSTOMS_HOLD', 'CUSTOMS_RELEASE']
    default:
      return []
  }
}

function buildHighlightedEventTypes(alerts: readonly AlertDisplayVM[]): ReadonlySet<string> {
  const types = new Set<string>()
  for (const alert of alerts) {
    for (const eventType of alertTypeToEventTypes(alert.type)) {
      types.add(eventType)
    }
  }
  return types
}

function deriveCurrentVessel(container: ContainerDetailVM | null): string | null {
  if (!container) return null
  const timeline = container.timeline
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.vesselName && event.eventTimeType === 'ACTUAL') {
      return event.vesselName
    }
  }
  // Fallback: any vessel from expected events
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.vesselName) {
      return event.vesselName
    }
  }
  return null
}

function derivePortsRoute(container: ContainerDetailVM | null): string | null {
  if (!container) return null
  const ports = container.transshipment.ports
  if (ports.length === 0) return null
  return ports.map((p) => p.code).join(' \u2192 ')
}

export function TimelinePanel(props: Props): JSX.Element {
  const timeline = () => props.selectedContainer?.timeline ?? []
  const { t, keys } = useTranslation()
  const highlightedTypes = () => buildHighlightedEventTypes(props.alerts ?? [])
  const currentVessel = createMemo(() => deriveCurrentVessel(props.selectedContainer))
  const portsRoute = createMemo(() => derivePortsRoute(props.selectedContainer))
  const renderList = createMemo(() => buildTimelineRenderList(timeline()))

  return (
    <Panel title={t(keys.shipmentView.timeline.title)} bodyClass="px-2.5 py-1">
      <div>
        {/* Phase 6 — Timeline Header: Selected Container Context */}
        <Show when={props.selectedContainer}>
          {(container) => (
            <ContainerContextHeader
              container={container()}
              currentVessel={currentVessel()}
              portsRoute={portsRoute()}
            />
          )}
        </Show>
        <Show
          when={timeline().length > 0}
          fallback={
            <p class="py-3 text-center text-label text-slate-400">
              {t(keys.shipmentView.noEvents)}
            </p>
          }
        >
          <TimelineBlockList
            renderList={renderList()}
            carrier={props.carrier}
            containerNumber={props.selectedContainer?.number}
            nonMappedIndicatorVariant={props.nonMappedIndicatorVariant}
            highlightedTypes={highlightedTypes()}
          />
        </Show>
      </div>
    </Panel>
  )
}

type ContainerContextHeaderProps = {
  container: ContainerDetailVM
  currentVessel: string | null
  portsRoute: string | null
}

function ContainerContextHeader(props: ContainerContextHeaderProps): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <div class="mb-1.5 space-y-1 border-b border-slate-100 pb-1.5">
      {/* Container identity + status */}
      <div class="flex items-center gap-1.5">
        <span class="text-label font-semibold tracking-wide text-slate-700">
          {props.container.number}
        </span>
        <StatusBadge
          variant={props.container.status}
          label={t(trackingStatusToLabelKey(keys, props.container.statusCode))}
        />
      </div>
      {/* Current vessel */}
      <Show when={props.currentVessel}>
        {(vessel) => (
          <div class="flex items-center gap-1">
            <span class="text-micro font-medium uppercase tracking-wider text-slate-400">
              {t(keys.shipmentView.timeline.vessel)}
            </span>
            <span class="text-micro font-semibold text-slate-600">{vessel()}</span>
          </div>
        )}
      </Show>
      {/* Intermediate ports route */}
      <Show when={props.portsRoute}>
        {(route) => (
          <div class="flex items-center gap-1">
            <span class="text-micro font-medium uppercase tracking-wider text-slate-400">
              {t(keys.shipmentView.transshipment.title)}
            </span>
            <span class="text-micro font-medium tabular-nums text-slate-500">{route()}</span>
          </div>
        )}
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group flat render items into renderable block groups
// ---------------------------------------------------------------------------

type BlockGroup =
  | {
      readonly kind: 'voyage'
      readonly block: Extract<TimelineRenderItem, { type: 'voyage-block' }>['block']
      readonly children: readonly TimelineRenderItem[]
    }
  | {
      readonly kind: 'terminal'
      readonly block: Extract<TimelineRenderItem, { type: 'terminal-block' }>['block']
      readonly children: readonly TimelineRenderItem[]
    }
  | {
      readonly kind: 'transshipment'
      readonly block: Extract<TimelineRenderItem, { type: 'transshipment-block' }>['block']
    }
  | { readonly kind: 'standalone'; readonly item: TimelineRenderItem }

function groupRenderItems(items: readonly TimelineRenderItem[]): readonly BlockGroup[] {
  const groups: BlockGroup[] = []
  let i = 0

  while (i < items.length) {
    const item = items[i]

    if (item.type === 'voyage-block' || item.type === 'terminal-block') {
      const children: TimelineRenderItem[] = []
      i++ // skip the block header
      // Collect until block-end
      while (i < items.length && items[i].type !== 'block-end') {
        children.push(items[i])
        i++
      }
      if (i < items.length && items[i].type === 'block-end') i++ // skip block-end

      if (item.type === 'voyage-block') {
        groups.push({ kind: 'voyage', block: item.block, children })
      } else {
        groups.push({ kind: 'terminal', block: item.block, children })
      }
    } else if (item.type === 'transshipment-block') {
      groups.push({ kind: 'transshipment', block: item.block })
      i++
    } else if (item.type === 'block-end') {
      i++ // skip orphan block-end
    } else {
      groups.push({ kind: 'standalone', item })
      i++
    }
  }

  return groups
}

// ---------------------------------------------------------------------------
// Render children (events, gap markers, port risk markers) inside a block
// ---------------------------------------------------------------------------

function BlockChildren(props: {
  readonly children: readonly TimelineRenderItem[]
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly highlightedTypes: ReadonlySet<string>
}): JSX.Element {
  let eventIdx = 0

  return (
    <div class="px-0.5 pb-1">
      <For each={props.children}>
        {(child) => {
          switch (child.type) {
            case 'event': {
              const showSep = eventIdx > 0
              eventIdx++
              return (
                <>
                  <Show when={showSep}>
                    <EventSeparator />
                  </Show>
                  <TimelineNode
                    event={child.event}
                    isLast={child.isLast}
                    carrier={props.carrier}
                    containerNumber={props.containerNumber}
                    nonMappedIndicatorVariant={props.nonMappedIndicatorVariant}
                    highlighted={props.highlightedTypes.has(child.event.type)}
                  />
                </>
              )
            }
            case 'gap-marker':
              return <GapMarkerRow marker={child.marker} />
            case 'port-risk-marker':
              return <PortRiskMarkerRow marker={child.marker} />
            default:
              return null
          }
        }}
      </For>
    </div>
  )
}

function TimelineBlockList(props: {
  readonly renderList: readonly TimelineRenderItem[]
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly highlightedTypes: ReadonlySet<string>
}): JSX.Element {
  const groups = () => groupRenderItems(props.renderList)

  return (
    <div>
      <For each={groups()}>
        {(group) => {
          switch (group.kind) {
            case 'voyage':
              return (
                <BlockCard variant="voyage">
                  <VoyageBlockHeader block={group.block} />
                  <BlockChildren
                    children={group.children}
                    carrier={props.carrier}
                    containerNumber={props.containerNumber}
                    nonMappedIndicatorVariant={props.nonMappedIndicatorVariant}
                    highlightedTypes={props.highlightedTypes}
                  />
                </BlockCard>
              )
            case 'terminal':
              return (
                <BlockCard variant="terminal">
                  <TerminalBlockHeader block={group.block} />
                  <BlockChildren
                    children={group.children}
                    carrier={props.carrier}
                    containerNumber={props.containerNumber}
                    nonMappedIndicatorVariant={props.nonMappedIndicatorVariant}
                    highlightedTypes={props.highlightedTypes}
                  />
                </BlockCard>
              )
            case 'transshipment':
              return <TransshipmentBlockCard block={group.block} />
            case 'standalone':
              switch (group.item.type) {
                case 'event':
                  return (
                    <TimelineNode
                      event={group.item.event}
                      isLast={group.item.isLast}
                      carrier={props.carrier}
                      containerNumber={props.containerNumber}
                      nonMappedIndicatorVariant={props.nonMappedIndicatorVariant}
                      highlighted={props.highlightedTypes.has(group.item.event.type)}
                    />
                  )
                case 'gap-marker':
                  return <GapMarkerRow marker={group.item.marker} />
                case 'port-risk-marker':
                  return <PortRiskMarkerRow marker={group.item.marker} />
                default:
                  return null
              }
            default:
              return null
          }
        }}
      </For>
    </div>
  )
}
