import { resolveTimelineEventLabel } from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import {
  resolveCurrentVoyageIndex,
  toCurrentVoyageGroups,
} from '~/modules/process/ui/timeline/currentVoyage'
import {
  buildTimelineRenderList,
  type PlannedTransshipmentBlock,
  type TerminalBlock,
  type TimelineRenderItem,
  type TransshipmentBlock,
  type VoyageBlock,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import {
  toPlannedTransshipmentBlockCanonicalTitle,
  toPlannedTransshipmentBlockDisplayTitle,
  toPlannedTransshipmentHandoffSummary,
  toTerminalBlockCanonicalTitle,
  toTerminalBlockDisplayTitle,
  toTimelineEventsBlockTitle,
  toTimelineMarkersBlockTitle,
  toTransshipmentBlockCanonicalTitle,
  toTransshipmentBlockDisplayTitle,
  toTransshipmentHandoffSummary,
  toVoyageBlockBadges,
  toVoyageBlockCanonicalTitle,
  toVoyageBlockDisplayTitle,
  toVoyageBlockRoute,
} from '~/modules/process/ui/timeline/timelineBlockPresentation'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import { systemClock } from '~/shared/time/clock'
import { parseInstantFromIso } from '~/shared/time/parsing'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type TranslateFn = (key: string, params?: Readonly<Record<string, unknown>>) => string

type TimelineExportCurrentContext = {
  readonly locationDisplay: string | null
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly vesselVisible: boolean
}

type TimelineExportTransshipment = {
  readonly hasTransshipment: boolean
  readonly count: number
  readonly ports: readonly {
    readonly code: string
    readonly display: string | null
  }[]
}

type TimelineExportEta = {
  readonly date: string
  readonly state: string
  readonly type: string
} | null

export type TimelineTextExportSource = {
  readonly mode: 'current' | 'historical'
  readonly title: string
  readonly containerNumber: string
  readonly statusCode: string
  readonly statusLabel: string
  readonly eta: TimelineExportEta
  readonly currentContext: TimelineExportCurrentContext
  readonly transshipment: TimelineExportTransshipment
  readonly renderList: readonly TimelineRenderItem[]
  readonly referenceNowIso: string | null
}

type TimelineTextExportDependencies = {
  readonly t: TranslateFn
  readonly keys: TranslationKeys
  readonly locale: string
}

type CurrentTimelineExportContainer = Pick<
  ContainerDetailVM,
  'number' | 'statusCode' | 'selectedEtaVm' | 'currentContext' | 'transshipment' | 'timeline'
>

type HistoricalTimelineExportSync = Pick<
  TrackingTimeTravelSyncVM,
  'statusCode' | 'eta' | 'currentContext' | 'transshipment' | 'timeline'
>

function buildRenderListForExport(
  timeline: CurrentTimelineExportContainer['timeline'] | HistoricalTimelineExportSync['timeline'],
  referenceNowIso: string | null,
): readonly TimelineRenderItem[] {
  const referenceNow = referenceNowIso === null ? null : parseInstantFromIso(referenceNowIso)

  return buildTimelineRenderList(timeline, referenceNow ?? systemClock.now())
}

export function toCurrentTimelineTextExportSource(command: {
  readonly title: string
  readonly statusLabel: string
  readonly container: CurrentTimelineExportContainer
}): TimelineTextExportSource {
  return {
    mode: 'current',
    title: command.title,
    containerNumber: command.container.number,
    statusCode: command.container.statusCode,
    statusLabel: command.statusLabel,
    eta:
      command.container.selectedEtaVm === null
        ? null
        : {
            date: command.container.selectedEtaVm.date,
            state: command.container.selectedEtaVm.state,
            type: command.container.selectedEtaVm.type,
          },
    currentContext: command.container.currentContext,
    transshipment: command.container.transshipment,
    renderList: buildRenderListForExport(command.container.timeline, null),
    referenceNowIso: null,
  }
}

export function toHistoricalTimelineTextExportSource(command: {
  readonly title: string
  readonly containerNumber: string | null
  readonly statusLabel: string
  readonly sync: HistoricalTimelineExportSync
  readonly referenceNowIso: string | null
}): TimelineTextExportSource {
  return {
    mode: 'historical',
    title: command.title,
    containerNumber: command.containerNumber ?? '',
    statusCode: command.sync.statusCode,
    statusLabel: command.statusLabel,
    eta:
      command.sync.eta === null
        ? null
        : {
            date: command.sync.eta.date,
            state: command.sync.eta.state,
            type: command.sync.eta.type,
          },
    currentContext: command.sync.currentContext,
    transshipment: command.sync.transshipment,
    renderList: buildRenderListForExport(command.sync.timeline, command.referenceNowIso),
    referenceNowIso: command.referenceNowIso,
  }
}

export function shouldShowTimelineCopyAction(source: TimelineTextExportSource | null): boolean {
  return source !== null && source.renderList.length > 0
}

function pushLine(lines: string[], value: string): void {
  lines.push(value)
}

function pushKeyValue(lines: string[], key: string, value: string | null): void {
  if (value === null || value.trim().length === 0) {
    return
  }

  lines.push(`${key}: ${value}`)
}

function pushBlockHeader(
  lines: string[],
  command: {
    readonly kind: string
    readonly canonicalTitle: string
    readonly displayTitle: string
    readonly badges?: readonly string[]
  },
): void {
  pushLine(lines, `## Bloco: ${command.canonicalTitle}`)
  pushLine(lines, `block_kind: ${command.kind}`)
  pushLine(lines, `block_title_canonical: ${command.canonicalTitle}`)
  pushLine(lines, `block_title_display: ${command.displayTitle}`)

  if ((command.badges?.length ?? 0) > 0) {
    pushLine(lines, `block_badges: ${command.badges?.join(' | ') ?? ''}`)
  }
}

function toTerminalBlockKind(block: TerminalBlock): string {
  switch (block.kind) {
    case 'pre-carriage':
      return 'PRE_CARRIAGE'
    case 'transshipment-terminal':
      return 'TRANSSHIPMENT_TERMINAL'
    case 'post-carriage':
      return 'POST_CARRIAGE'
  }
}

function toMarkerLabel(
  item: Extract<TimelineRenderItem, { readonly type: 'gap-marker' | 'port-risk-marker' }>,
  dependencies: TimelineTextExportDependencies,
): string {
  if (item.type === 'gap-marker') {
    return item.marker.kind === 'transit'
      ? dependencies.t(dependencies.keys.shipmentView.timeline.blocks.gapTransit, {
          days: item.marker.durationDays,
        })
      : dependencies.t(dependencies.keys.shipmentView.timeline.blocks.gapGeneric, {
          days: item.marker.durationDays,
        })
  }

  if (item.marker.ongoing) {
    return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.portRiskOngoing, {
      days: item.marker.durationDays,
    })
  }

  return item.marker.severity === 'danger'
    ? dependencies.t(dependencies.keys.shipmentView.timeline.blocks.portRiskClosed, {
        days: item.marker.durationDays,
      })
    : dependencies.t(dependencies.keys.shipmentView.timeline.blocks.portRiskShort, {
        days: item.marker.durationDays,
      })
}

function toIntermediatePorts(source: TimelineTextExportSource): string | null {
  if (!source.transshipment.hasTransshipment || source.transshipment.ports.length === 0) {
    return null
  }

  return source.transshipment.ports
    .map((port) => port.display ?? port.code)
    .filter((port) => port.trim().length > 0)
    .join(' | ')
}

function serializeEvent(
  lines: string[],
  item: Extract<TimelineRenderItem, { readonly type: 'event' }>,
  dependencies: TimelineTextExportDependencies,
): void {
  pushLine(
    lines,
    `- label: ${resolveTimelineEventLabel(item.event, dependencies.t, dependencies.keys)}`,
  )
  pushLine(lines, `  type: ${item.event.type}`)
  pushLine(lines, `  event_time_type: ${item.event.eventTimeType}`)
  pushKeyValue(
    lines,
    '  date',
    item.event.eventTime === null
      ? null
      : formatDateForLocale(item.event.eventTime, dependencies.locale),
  )
  pushKeyValue(lines, '  location', item.event.location ?? null)
  pushKeyValue(lines, '  vessel', item.event.vesselName ?? null)
  pushKeyValue(lines, '  voyage', item.event.voyage ?? null)
}

function serializeMarker(
  lines: string[],
  item: Extract<TimelineRenderItem, { readonly type: 'gap-marker' | 'port-risk-marker' }>,
  dependencies: TimelineTextExportDependencies,
): void {
  if (item.type === 'gap-marker') {
    pushLine(lines, '- marker_kind: GAP')
    pushLine(lines, `  label: ${toMarkerLabel(item, dependencies)}`)
    pushLine(lines, `  gap_kind: ${item.marker.kind.toUpperCase()}`)
    pushLine(lines, `  duration_days: ${String(item.marker.durationDays)}`)
    pushLine(lines, `  from_event_type: ${item.marker.fromEventType}`)
    pushLine(lines, `  to_event_type: ${item.marker.toEventType}`)
    return
  }

  pushLine(lines, '- marker_kind: PORT_RISK')
  pushLine(lines, `  label: ${toMarkerLabel(item, dependencies)}`)
  pushLine(lines, `  severity: ${item.marker.severity.toUpperCase()}`)
  pushLine(lines, `  ongoing: ${item.marker.ongoing ? 'true' : 'false'}`)
  pushLine(lines, `  duration_days: ${String(item.marker.durationDays)}`)
}

function serializeBlockChildren(
  lines: string[],
  renderList: readonly TimelineRenderItem[],
  startIndex: number,
  dependencies: TimelineTextExportDependencies,
): number {
  let index = startIndex

  while (index < renderList.length) {
    const child = renderList[index]
    if (
      child === undefined ||
      child.type === 'block-end' ||
      child.type === 'voyage-block' ||
      child.type === 'terminal-block' ||
      child.type === 'transshipment-block' ||
      child.type === 'planned-transshipment-block'
    ) {
      break
    }

    if (child.type === 'event') {
      serializeEvent(lines, child, dependencies)
    } else if (child.type === 'gap-marker' || child.type === 'port-risk-marker') {
      serializeMarker(lines, child, dependencies)
    }

    index += 1
  }

  return renderList[index]?.type === 'block-end' ? index + 1 : index
}

function serializeInlineMarkerChildren(
  lines: string[],
  renderList: readonly TimelineRenderItem[],
  startIndex: number,
  dependencies: TimelineTextExportDependencies,
): number {
  let index = startIndex

  while (index < renderList.length) {
    const child = renderList[index]
    if (child === undefined || (child.type !== 'gap-marker' && child.type !== 'port-risk-marker')) {
      break
    }

    serializeMarker(lines, child, dependencies)
    index += 1
  }

  return index
}

function serializeStandaloneItems(
  lines: string[],
  renderList: readonly TimelineRenderItem[],
  startIndex: number,
  dependencies: TimelineTextExportDependencies,
): number {
  const firstItem = renderList[startIndex]
  if (firstItem === undefined) {
    return startIndex
  }

  if (firstItem.type === 'gap-marker' || firstItem.type === 'port-risk-marker') {
    const title = toTimelineMarkersBlockTitle(dependencies)
    pushBlockHeader(lines, {
      kind: 'TIMELINE_MARKERS',
      canonicalTitle: title,
      displayTitle: title,
    })

    let index = startIndex
    while (index < renderList.length) {
      const child = renderList[index]
      if (
        child === undefined ||
        (child.type !== 'gap-marker' && child.type !== 'port-risk-marker')
      ) {
        break
      }

      serializeMarker(lines, child, dependencies)
      index += 1
    }

    return index
  }

  const title = toTimelineEventsBlockTitle(dependencies)
  pushBlockHeader(lines, {
    kind: 'TIMELINE_EVENTS',
    canonicalTitle: title,
    displayTitle: title,
  })

  let index = startIndex
  while (index < renderList.length) {
    const child = renderList[index]
    if (
      child === undefined ||
      child.type === 'block-end' ||
      child.type === 'voyage-block' ||
      child.type === 'terminal-block' ||
      child.type === 'transshipment-block' ||
      child.type === 'planned-transshipment-block'
    ) {
      break
    }

    if (child.type === 'event') {
      serializeEvent(lines, child, dependencies)
    } else if (child.type === 'gap-marker' || child.type === 'port-risk-marker') {
      serializeMarker(lines, child, dependencies)
    }

    index += 1
  }

  return index
}

function buildRenderIndexToCurrentVoyageGroupIndex(
  renderList: readonly TimelineRenderItem[],
): ReadonlyMap<number, number> {
  const groupIndexByRenderIndex = new Map<number, number>()
  let groupIndex = 0
  let index = 0

  while (index < renderList.length) {
    const item = renderList[index]
    if (item === undefined) {
      break
    }

    if (item.type === 'block-end') {
      index += 1
      continue
    }

    groupIndexByRenderIndex.set(index, groupIndex)

    if (item.type === 'voyage-block' || item.type === 'terminal-block') {
      groupIndex += 1
      index += 1
      while (index < renderList.length) {
        const child = renderList[index]
        if (
          child === undefined ||
          child.type === 'block-end' ||
          child.type === 'voyage-block' ||
          child.type === 'terminal-block' ||
          child.type === 'transshipment-block' ||
          child.type === 'planned-transshipment-block'
        ) {
          break
        }
        index += 1
      }
      if (renderList[index]?.type === 'block-end') {
        index += 1
      }
      continue
    }

    groupIndex += 1
    index += 1
  }

  return groupIndexByRenderIndex
}

function serializeVoyageBlock(
  lines: string[],
  block: VoyageBlock,
  dependencies: TimelineTextExportDependencies,
  options?: { readonly isCurrent?: boolean },
): void {
  pushBlockHeader(lines, {
    kind: 'VOYAGE',
    canonicalTitle: toVoyageBlockCanonicalTitle(dependencies),
    displayTitle: toVoyageBlockDisplayTitle(block, dependencies),
    badges: toVoyageBlockBadges(dependencies, options),
  })
  pushKeyValue(lines, 'vessel', block.vessel)
  pushKeyValue(lines, 'voyage', block.voyage)
  pushKeyValue(lines, 'route', toVoyageBlockRoute(block, dependencies))
}

function serializeTerminalBlock(
  lines: string[],
  block: TerminalBlock,
  dependencies: TimelineTextExportDependencies,
): void {
  pushBlockHeader(lines, {
    kind: toTerminalBlockKind(block),
    canonicalTitle: toTerminalBlockCanonicalTitle(block, dependencies),
    displayTitle: toTerminalBlockDisplayTitle(block, dependencies),
  })
  pushKeyValue(lines, 'location', block.location)
}

function serializeTransshipmentBlock(
  lines: string[],
  block: TransshipmentBlock,
  dependencies: TimelineTextExportDependencies,
): void {
  const isPlanned = block.mode === 'planned'
  const representativeEvent = block.events[block.events.length - 1] ?? null

  pushBlockHeader(lines, {
    kind: isPlanned ? 'PLANNED_TRANSSHIPMENT' : 'TRANSSHIPMENT',
    canonicalTitle: toTransshipmentBlockCanonicalTitle(block, dependencies),
    displayTitle: toTransshipmentBlockDisplayTitle(block, dependencies),
  })
  pushLine(lines, `transshipment_mode: ${block.mode.toUpperCase()}`)
  pushKeyValue(lines, 'location', block.port)
  pushKeyValue(lines, 'handoff_summary', toTransshipmentHandoffSummary(block, dependencies))
  pushKeyValue(lines, 'reason', block.reason)
  if (isPlanned && representativeEvent !== null) {
    pushLine(lines, `canonical_type: ${representativeEvent.type}`)
    pushLine(lines, `event_time_type: ${representativeEvent.eventTimeType}`)
    pushKeyValue(
      lines,
      'date',
      representativeEvent.eventTime === null
        ? null
        : formatDateForLocale(representativeEvent.eventTime, dependencies.locale),
    )
  }
  pushKeyValue(lines, 'from_vessel', block.previousVesselName)
  pushKeyValue(lines, 'from_voyage', block.previousVoyage)
  pushKeyValue(lines, 'to_vessel', block.nextVesselName)
  pushKeyValue(lines, 'to_voyage', block.nextVoyage)
}

function serializePlannedTransshipmentBlock(
  lines: string[],
  block: PlannedTransshipmentBlock,
  dependencies: TimelineTextExportDependencies,
): void {
  pushBlockHeader(lines, {
    kind: 'PLANNED_TRANSSHIPMENT',
    canonicalTitle: toPlannedTransshipmentBlockCanonicalTitle(dependencies),
    displayTitle: toPlannedTransshipmentBlockDisplayTitle(dependencies),
  })
  pushKeyValue(lines, 'location', block.port)
  pushKeyValue(lines, 'handoff_summary', toPlannedTransshipmentHandoffSummary(block, dependencies))
  pushLine(lines, `canonical_type: ${block.event.type}`)
  pushLine(lines, `event_time_type: ${block.event.eventTimeType}`)
  pushKeyValue(
    lines,
    'date',
    block.event.eventTime === null
      ? null
      : formatDateForLocale(block.event.eventTime, dependencies.locale),
  )
  pushKeyValue(lines, 'from_vessel', block.fromVessel)
  pushKeyValue(lines, 'from_voyage', block.fromVoyage)
  pushKeyValue(lines, 'to_vessel', block.toVessel)
  pushKeyValue(lines, 'to_voyage', block.toVoyage)
}

export function serializeTimelineToText(
  source: TimelineTextExportSource,
  dependencies: TimelineTextExportDependencies,
): string {
  const lines: string[] = []

  pushLine(lines, `# ${source.title}`)
  pushKeyValue(lines, 'container', source.containerNumber)
  pushLine(lines, `export_mode: ${source.mode.toUpperCase()}`)
  pushLine(lines, `status: ${source.statusLabel}`)
  pushLine(lines, `status_code: ${source.statusCode}`)
  pushKeyValue(lines, 'eta', source.eta?.date ?? null)
  pushKeyValue(lines, 'eta_state', source.eta?.state ?? null)
  pushKeyValue(lines, 'eta_type', source.eta?.type ?? null)
  pushKeyValue(lines, 'current_location', source.currentContext.locationDisplay)
  pushKeyValue(
    lines,
    'current_vessel',
    source.currentContext.vesselVisible ? source.currentContext.vesselName : null,
  )
  pushKeyValue(lines, 'current_voyage', source.currentContext.voyage)
  pushKeyValue(lines, 'intermediate_ports', toIntermediatePorts(source))
  pushKeyValue(lines, 'reference_now', source.referenceNowIso)

  if (source.renderList.length > 0) {
    pushLine(lines, '')
  }

  const currentVoyageIndex = resolveCurrentVoyageIndex(toCurrentVoyageGroups(source.renderList))
  const groupIndexByRenderIndex = buildRenderIndexToCurrentVoyageGroupIndex(source.renderList)
  let index = 0
  while (index < source.renderList.length) {
    const item = source.renderList[index]
    if (item === undefined) {
      break
    }

    switch (item.type) {
      case 'voyage-block':
        serializeVoyageBlock(lines, item.block, dependencies, {
          isCurrent: groupIndexByRenderIndex.get(index) === currentVoyageIndex,
        })
        index = serializeBlockChildren(lines, source.renderList, index + 1, dependencies)
        pushLine(lines, '')
        continue
      case 'terminal-block':
        serializeTerminalBlock(lines, item.block, dependencies)
        index = serializeBlockChildren(lines, source.renderList, index + 1, dependencies)
        pushLine(lines, '')
        continue
      case 'transshipment-block':
        serializeTransshipmentBlock(lines, item.block, dependencies)
        index = serializeInlineMarkerChildren(lines, source.renderList, index + 1, dependencies)
        pushLine(lines, '')
        continue
      case 'planned-transshipment-block':
        serializePlannedTransshipmentBlock(lines, item.block, dependencies)
        index = serializeInlineMarkerChildren(lines, source.renderList, index + 1, dependencies)
        pushLine(lines, '')
        continue
      case 'event':
      case 'gap-marker':
      case 'port-risk-marker':
        index = serializeStandaloneItems(lines, source.renderList, index, dependencies)
        pushLine(lines, '')
        continue
      case 'block-end':
        index += 1
        continue
    }
  }

  return lines.join('\n').trimEnd()
}
