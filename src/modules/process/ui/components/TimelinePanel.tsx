import { createMemo, For, type JSX, Show } from 'solid-js'
import { TimelineNode } from '~/modules/process/ui/components/TimelineNode'
import type { NonMappedIndicatorVariant } from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  resolveCurrentVoyageIndex,
  toCurrentVoyageGroups,
} from '~/modules/process/ui/timeline/currentVoyage'
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
import { deriveCurrentVesselFromTimeline } from '~/modules/process/ui/utils/current-tracking-context'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type {
  ContainerDetailVM,
  ContainerObservationVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  selectedContainer: ContainerDetailVM | null
  carrier?: string | null
  nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  alerts?: readonly AlertDisplayVM[]
}

type TrackingTimelinePanelContainerContext = Pick<
  ContainerDetailVM,
  'number' | 'status' | 'statusCode' | 'transshipment'
>

type TrackingTimelinePanelContentProps = {
  readonly title: string
  readonly container: TrackingTimelinePanelContainerContext | null
  readonly timeline: readonly TrackingTimelineItem[]
  readonly observations?: readonly ContainerObservationVM[]
  readonly carrier?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly alerts?: readonly AlertDisplayVM[]
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

function derivePortsRoute(container: TrackingTimelinePanelContainerContext | null): string | null {
  if (!container) return null
  const ports = container.transshipment.ports
  if (ports.length === 0) return null
  return ports.map((p) => p.code).join(' \u2192 ')
}

function buildObservationsById(
  observations: readonly ContainerObservationVM[],
): ReadonlyMap<string, ContainerObservationVM> {
  const observationsById = new Map<string, ContainerObservationVM>()
  for (const observation of observations) {
    observationsById.set(observation.id, observation)
  }
  return observationsById
}

function toOptionalTimelineBlockListProps(params: {
  readonly carrier: string | null | undefined
  readonly containerNumber: string | null | undefined
  readonly nonMappedIndicatorVariant: NonMappedIndicatorVariant | undefined
}): {
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
} {
  return {
    ...(params.carrier === undefined ? {} : { carrier: params.carrier }),
    ...(params.containerNumber === undefined ? {} : { containerNumber: params.containerNumber }),
    ...(params.nonMappedIndicatorVariant === undefined
      ? {}
      : { nonMappedIndicatorVariant: params.nonMappedIndicatorVariant }),
  }
}

function toOptionalTrackingTimelinePanelContentProps(params: {
  readonly observations: readonly ContainerObservationVM[] | undefined
  readonly carrier: string | null | undefined
  readonly nonMappedIndicatorVariant: NonMappedIndicatorVariant | undefined
  readonly alerts: readonly AlertDisplayVM[] | undefined
}): {
  readonly observations?: readonly ContainerObservationVM[]
  readonly carrier?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly alerts?: readonly AlertDisplayVM[]
} {
  return {
    ...(params.observations === undefined ? {} : { observations: params.observations }),
    ...(params.carrier === undefined ? {} : { carrier: params.carrier }),
    ...(params.nonMappedIndicatorVariant === undefined
      ? {}
      : { nonMappedIndicatorVariant: params.nonMappedIndicatorVariant }),
    ...(params.alerts === undefined ? {} : { alerts: params.alerts }),
  }
}

function toOptionalTimelineNodeProps(params: {
  readonly carrier: string | null | undefined
  readonly containerNumber: string | null | undefined
  readonly observation: ContainerObservationVM | undefined
  readonly nonMappedIndicatorVariant: NonMappedIndicatorVariant | undefined
  readonly highlighted: boolean | undefined
}): {
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly observation?: ContainerObservationVM
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly highlighted?: boolean
} {
  return {
    ...(params.carrier === undefined ? {} : { carrier: params.carrier }),
    ...(params.containerNumber === undefined ? {} : { containerNumber: params.containerNumber }),
    ...(params.observation === undefined ? {} : { observation: params.observation }),
    ...(params.nonMappedIndicatorVariant === undefined
      ? {}
      : { nonMappedIndicatorVariant: params.nonMappedIndicatorVariant }),
    ...(params.highlighted === undefined ? {} : { highlighted: params.highlighted }),
  }
}

export function TrackingTimelinePanelContent(
  props: TrackingTimelinePanelContentProps,
): JSX.Element {
  const { t, keys } = useTranslation()
  const timeline = () => props.timeline
  const highlightedTypes = () => buildHighlightedEventTypes(props.alerts ?? [])
  const currentVessel = createMemo(() => deriveCurrentVesselFromTimeline(props.timeline))
  const portsRoute = createMemo(() => derivePortsRoute(props.container))
  const observationsById = createMemo(() => buildObservationsById(props.observations ?? []))
  const renderList = createMemo(() => buildTimelineRenderList(timeline()))

  return (
    <Panel title={props.title} class="rounded-xl" bodyClass="px-3 py-3">
      <div>
        {/* Phase 6 — Timeline Header: Selected Container Context */}
        <Show when={props.container}>
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
            <p class="py-3 text-center text-xs-ui text-text-muted">
              {t(keys.shipmentView.noEvents)}
            </p>
          }
        >
          <TimelineBlockList
            renderList={renderList()}
            highlightedTypes={highlightedTypes()}
            observationById={observationsById()}
            {...toOptionalTimelineBlockListProps({
              carrier: props.carrier,
              containerNumber: props.container?.number,
              nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
            })}
          />
        </Show>
      </div>
    </Panel>
  )
}

type ContainerContextHeaderProps = {
  container: TrackingTimelinePanelContainerContext
  currentVessel: string | null
  portsRoute: string | null
}

function ContainerContextHeader(props: ContainerContextHeaderProps): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <div class="mb-2 space-y-1.5 border-b border-border/70 pb-2">
      {/* Container identity + status */}
      <div class="flex items-center gap-1.5">
        <span class="text-xs-ui font-semibold tracking-wide text-foreground">
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
            <span class="text-micro font-medium uppercase tracking-wider text-text-muted">
              {t(keys.shipmentView.timeline.vessel)}
            </span>
            <span class="text-micro font-semibold text-foreground">{vessel()}</span>
          </div>
        )}
      </Show>
      {/* Intermediate ports route */}
      <Show when={props.portsRoute}>
        {(route) => (
          <div class="flex items-center gap-1">
            <span class="text-micro font-medium uppercase tracking-wider text-text-muted">
              {t(keys.shipmentView.transshipment.title)}
            </span>
            <span class="text-micro font-medium tabular-nums text-text-muted">{route()}</span>
          </div>
        )}
      </Show>
    </div>
  )
}

export function TimelinePanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <TrackingTimelinePanelContent
      title={t(keys.shipmentView.timeline.title)}
      container={props.selectedContainer}
      timeline={props.selectedContainer?.timeline ?? []}
      {...toOptionalTrackingTimelinePanelContentProps({
        observations: props.selectedContainer?.observations ?? [],
        carrier: props.carrier,
        nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
        alerts: props.alerts,
      })}
    />
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
    if (item === undefined) break

    if (item.type === 'voyage-block' || item.type === 'terminal-block') {
      const children: TimelineRenderItem[] = []
      i++ // skip the block header
      // Collect until block-end
      while (i < items.length) {
        const child = items[i]
        if (child === undefined || child.type === 'block-end') break
        children.push(child)
        i++
      }
      if (items[i]?.type === 'block-end') i++ // skip block-end

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
  readonly observationById: ReadonlyMap<string, ContainerObservationVM>
}): JSX.Element {
  let eventIdx = 0

  return (
    <div class="px-2.5 py-2">
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
                    {...toOptionalTimelineNodeProps({
                      carrier: props.carrier,
                      containerNumber: props.containerNumber,
                      observation: props.observationById.get(child.event.id),
                      nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
                      highlighted: props.highlightedTypes.has(child.event.type),
                    })}
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
  readonly observationById: ReadonlyMap<string, ContainerObservationVM>
}): JSX.Element {
  const groups = createMemo(() => groupRenderItems(props.renderList))
  const currentVoyageIdx = createMemo(() =>
    resolveCurrentVoyageIndex(toCurrentVoyageGroups(props.renderList)),
  )

  const renderGroupContent = (group: BlockGroup, isCurrent: boolean): JSX.Element | null => {
    switch (group.kind) {
      case 'voyage':
        return (
          <BlockCard variant="voyage" isCurrent={isCurrent}>
            <VoyageBlockHeader block={group.block} isCurrent={isCurrent} />
            <BlockChildren
              children={group.children}
              observationById={props.observationById}
              highlightedTypes={props.highlightedTypes}
              {...toOptionalTimelineBlockListProps({
                carrier: props.carrier,
                containerNumber: props.containerNumber,
                nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
              })}
            />
          </BlockCard>
        )
      case 'terminal':
        return (
          <BlockCard variant="terminal">
            <TerminalBlockHeader block={group.block} />
            <BlockChildren
              children={group.children}
              observationById={props.observationById}
              highlightedTypes={props.highlightedTypes}
              {...toOptionalTimelineBlockListProps({
                carrier: props.carrier,
                containerNumber: props.containerNumber,
                nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
              })}
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
                {...toOptionalTimelineNodeProps({
                  carrier: props.carrier,
                  containerNumber: props.containerNumber,
                  observation: props.observationById.get(group.item.event.id),
                  nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
                  highlighted: props.highlightedTypes.has(group.item.event.type),
                })}
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
  }

  return (
    <div class="mt-1 space-y-2.5">
      <For each={groups()}>
        {(group, index) => {
          const isCurrent = createMemo(() => index() === currentVoyageIdx())
          return <div>{renderGroupContent(group, isCurrent())}</div>
        }}
      </For>
    </div>
  )
}
