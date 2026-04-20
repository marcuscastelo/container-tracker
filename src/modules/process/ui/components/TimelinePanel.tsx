import { Check, Copy } from 'lucide-solid'
import { createMemo, For, type JSX, Show } from 'solid-js'
import toast from 'solid-toast'
import { TimelineNode } from '~/modules/process/ui/components/TimelineNode'
import type { NonMappedIndicatorVariant } from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  serializeTimelineToText,
  shouldShowTimelineCopyAction,
  type TimelineTextExportSource,
  toCurrentTimelineTextExportSource,
} from '~/modules/process/ui/screens/shipment/lib/serializeTimelineToText'
import {
  resolveCurrentVoyageIndex,
  toCurrentVoyageGroups,
} from '~/modules/process/ui/timeline/currentVoyage'
import {
  BlockCard,
  EventSeparator,
  GapMarkerRow,
  PlannedTransshipmentBlockCard,
  PortRiskMarkerRow,
  TerminalBlockHeader,
  TransshipmentBlockCard,
  VoyageBlockHeader,
} from '~/modules/process/ui/timeline/TimelineBlocks'
import {
  buildTimelineRenderList,
  type TimelineRenderItem,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'
import { useTransientFlag } from '~/shared/ui/motion/useTransientFlag'
import { StatusBadge } from '~/shared/ui/StatusBadge'
import { copyToClipboard } from '~/shared/utils/clipboard'

type Props = {
  selectedContainer: ContainerDetailVM | null
  carrier?: string | null
  nonMappedIndicatorVariant?: NonMappedIndicatorVariant
}

type TrackingTimelinePanelContainerContext = Pick<
  ContainerDetailVM,
  'number' | 'status' | 'statusCode' | 'transshipment' | 'currentContext'
>

type TrackingTimelinePanelContentProps = {
  readonly title: string
  readonly container: TrackingTimelinePanelContainerContext | null
  readonly containerId: string | null
  readonly timeline: readonly TrackingTimelineItem[]
  readonly exportSource: TimelineTextExportSource | null
  readonly carrier?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
}

function derivePortsRoute(container: TrackingTimelinePanelContainerContext | null): string | null {
  if (!container) return null
  const ports = container.transshipment.ports
  if (ports.length === 0) return null
  return ports.map((p) => p.code).join(' \u2192 ')
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
  readonly containerId: string | null
  readonly carrier: string | null | undefined
  readonly nonMappedIndicatorVariant: NonMappedIndicatorVariant | undefined
}): {
  readonly containerId: string | null
  readonly carrier?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
} {
  return {
    containerId: params.containerId,
    ...(params.carrier === undefined ? {} : { carrier: params.carrier }),
    ...(params.nonMappedIndicatorVariant === undefined
      ? {}
      : { nonMappedIndicatorVariant: params.nonMappedIndicatorVariant }),
  }
}

function toOptionalTimelineNodeProps(params: {
  readonly containerId: string
  readonly carrier: string | null | undefined
  readonly containerNumber: string | null | undefined
  readonly nonMappedIndicatorVariant: NonMappedIndicatorVariant | undefined
}): {
  readonly containerId: string
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
} {
  return {
    containerId: params.containerId,
    ...(params.carrier === undefined ? {} : { carrier: params.carrier }),
    ...(params.containerNumber === undefined ? {} : { containerNumber: params.containerNumber }),
    ...(params.nonMappedIndicatorVariant === undefined
      ? {}
      : { nonMappedIndicatorVariant: params.nonMappedIndicatorVariant }),
  }
}

export function TrackingTimelinePanelContent(
  props: TrackingTimelinePanelContentProps,
): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const copyFeedback = useTransientFlag()
  const timeline = () => props.timeline
  const currentVessel = createMemo(() =>
    props.container?.currentContext.vesselVisible === false
      ? null
      : (props.container?.currentContext.vesselName ?? null),
  )
  const portsRoute = createMemo(() => derivePortsRoute(props.container))
  const renderList = createMemo(
    () => props.exportSource?.renderList ?? buildTimelineRenderList(timeline()),
  )
  const showCopyAction = createMemo(() => shouldShowTimelineCopyAction(props.exportSource))

  const handleCopyTimeline = async (): Promise<void> => {
    if (props.exportSource === null) {
      return
    }

    try {
      const copied = await copyToClipboard(
        serializeTimelineToText(props.exportSource, {
          t,
          keys,
          locale: locale(),
        }),
      )
      if (copied) {
        copyFeedback.activate()
      } else {
        toast.error(t(keys.shipmentView.actions.copyTimelineError))
      }
    } catch (error) {
      console.error('Failed to copy timeline text export', error)
      toast.error(t(keys.shipmentView.actions.copyTimelineError))
    }
  }

  return (
    <Panel
      title={props.title}
      class="rounded-xl"
      bodyClass="px-3 py-3"
      headerSlot={
        <Show when={showCopyAction()}>
          <button
            type="button"
            class="motion-focus-surface motion-interactive inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs-ui font-medium text-foreground hover:bg-surface-muted"
            onClick={() => void handleCopyTimeline()}
          >
            <Show
              when={copyFeedback.isActive()}
              fallback={<Copy class="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />}
            >
              <Check
                class="motion-copy-feedback h-3.5 w-3.5 shrink-0 text-tone-success-fg"
                aria-hidden="true"
              />
            </Show>
            <span
              class="motion-copy-feedback"
              data-state={copyFeedback.isActive() ? 'copied' : 'idle'}
            >
              {copyFeedback.isActive()
                ? t(keys.shipmentView.actions.copyTimelineCopied)
                : t(keys.shipmentView.actions.copyTimeline)}
            </span>
          </button>
        </Show>
      }
    >
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
            containerId={props.containerId}
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
  const exportSource = createMemo<TimelineTextExportSource | null>(() => {
    if (props.selectedContainer === null) {
      return null
    }

    return toCurrentTimelineTextExportSource({
      title: t(keys.shipmentView.timeline.title),
      statusLabel: t(trackingStatusToLabelKey(keys, props.selectedContainer.statusCode)),
      container: props.selectedContainer,
    })
  })

  return (
    <TrackingTimelinePanelContent
      title={t(keys.shipmentView.timeline.title)}
      container={props.selectedContainer}
      timeline={props.selectedContainer?.timeline ?? []}
      exportSource={exportSource()}
      {...toOptionalTrackingTimelinePanelContentProps({
        containerId: props.selectedContainer?.id ?? null,
        carrier: props.carrier,
        nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
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
  | {
      readonly kind: 'planned-transshipment'
      readonly block: Extract<TimelineRenderItem, { type: 'planned-transshipment-block' }>['block']
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
    } else if (item.type === 'planned-transshipment-block') {
      groups.push({ kind: 'planned-transshipment', block: item.block })
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
  readonly containerId: string
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
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
                      containerId: props.containerId,
                      carrier: props.carrier,
                      containerNumber: props.containerNumber,
                      nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
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
  readonly containerId: string | null
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
}): JSX.Element {
  const groups = createMemo(() => groupRenderItems(props.renderList))
  const currentVoyageIdx = createMemo(() =>
    resolveCurrentVoyageIndex(toCurrentVoyageGroups(props.renderList)),
  )

  const renderGroupContent = (group: BlockGroup, isCurrent: boolean): JSX.Element | null => {
    switch (group.kind) {
      case 'voyage': {
        if (props.containerId === null) return null
        const containerId: string = props.containerId
        return (
          <BlockCard variant="voyage" isCurrent={isCurrent}>
            <VoyageBlockHeader block={group.block} isCurrent={isCurrent} />
            <BlockChildren
              children={group.children}
              containerId={containerId}
              {...toOptionalTimelineBlockListProps({
                carrier: props.carrier,
                containerNumber: props.containerNumber,
                nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
              })}
            />
          </BlockCard>
        )
      }
      case 'terminal': {
        if (props.containerId === null) return null
        const containerId: string = props.containerId
        return (
          <BlockCard variant="terminal">
            <TerminalBlockHeader block={group.block} />
            <BlockChildren
              children={group.children}
              containerId={containerId}
              {...toOptionalTimelineBlockListProps({
                carrier: props.carrier,
                containerNumber: props.containerNumber,
                nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
              })}
            />
          </BlockCard>
        )
      }
      case 'transshipment':
        return (
          <TransshipmentBlockCard
            block={group.block}
            containerId={props.containerId}
            carrier={props.carrier}
            containerNumber={props.containerNumber}
          />
        )
      case 'planned-transshipment':
        return <PlannedTransshipmentBlockCard block={group.block} />
      case 'standalone':
        switch (group.item.type) {
          case 'event':
            if (props.containerId === null) return null
            return (
              <TimelineNode
                event={group.item.event}
                isLast={group.item.isLast}
                {...toOptionalTimelineNodeProps({
                  containerId: props.containerId,
                  carrier: props.carrier,
                  containerNumber: props.containerNumber,
                  nonMappedIndicatorVariant: props.nonMappedIndicatorVariant,
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
