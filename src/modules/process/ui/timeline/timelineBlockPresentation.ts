import type {
  PlannedTransshipmentBlock,
  TerminalBlock,
  TransshipmentBlock,
  VoyageBlock,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import type { TranslationKeys } from '~/shared/localization/translationTypes'

type TranslateFn = (key: string, params?: Readonly<Record<string, unknown>>) => string

export type TimelineBlockPresentationDependencies = {
  readonly t: TranslateFn
  readonly keys: TranslationKeys
}

function toVoyageCanonicalTitle(dependencies: TimelineBlockPresentationDependencies): string {
  return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.voyage)
}

export function toVoyageBlockDisplayTitle(
  block: VoyageBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return block.vessel ?? toVoyageCanonicalTitle(dependencies)
}

export function toVoyageBlockRoute(
  block: VoyageBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string | null {
  let origin = block.origin
  let destination = block.destination

  if (!origin) {
    for (const event of block.events) {
      if (event.location && (event.type === 'LOAD' || event.type === 'DEPARTURE')) {
        origin = event.location
        break
      }
    }
  }

  if (!destination) {
    for (let index = block.events.length - 1; index >= 0; index--) {
      const event = block.events[index]
      if (event === undefined) continue

      if (event.type === 'ARRIVAL' && event.eventTimeType === 'EXPECTED' && event.location) {
        destination = event.location
        break
      }
    }
  }

  if (!destination) {
    for (let index = block.events.length - 1; index >= 0; index--) {
      const event = block.events[index]
      if (event === undefined) continue

      if (event.type === 'DISCHARGE' && event.eventTimeType === 'EXPECTED' && event.location) {
        destination = event.location
        break
      }
    }
  }

  if (!destination) {
    for (let index = block.events.length - 1; index >= 0; index--) {
      const event = block.events[index]
      if (event === undefined) continue

      if (event.location && (event.type === 'ARRIVAL' || event.type === 'DISCHARGE')) {
        destination = event.location
        break
      }
    }
  }

  if (!origin && !destination) {
    return null
  }

  return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.voyageRoute, {
    origin: origin ?? '?',
    destination: destination ?? '?',
  })
}

export function toVoyageBlockBadges(
  dependencies: TimelineBlockPresentationDependencies,
  options?: { readonly isCurrent?: boolean },
): readonly string[] {
  if (options?.isCurrent !== true) {
    return []
  }

  return [dependencies.t(dependencies.keys.shipmentView.timeline.blocks.currentLeg)]
}

export function toVoyageBlockCanonicalTitle(
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return toVoyageCanonicalTitle(dependencies)
}

export function toTerminalBlockCanonicalTitle(
  block: TerminalBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string {
  switch (block.kind) {
    case 'pre-carriage':
      return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.preCarriage)
    case 'transshipment-terminal':
      return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.transshipmentTerminal)
    case 'post-carriage':
      return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.postCarriage)
  }
}

export function toTerminalBlockDisplayTitle(
  block: TerminalBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return toTerminalBlockCanonicalTitle(block, dependencies)
}

function toVesselHandoffSummary(
  fromVessel: string | null,
  toVessel: string | null,
  dependencies: TimelineBlockPresentationDependencies,
): string | null {
  if (fromVessel === null && toVessel === null) {
    return null
  }

  return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.vesselChangeDetail, {
    from: fromVessel ?? '?',
    to: toVessel ?? '?',
  })
}

export function toTransshipmentBlockCanonicalTitle(
  block: TransshipmentBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return dependencies.t(
    block.mode === 'planned'
      ? dependencies.keys.shipmentView.timeline.blocks.plannedTransshipment
      : dependencies.keys.shipmentView.timeline.blocks.transshipment,
  )
}

export function toTransshipmentBlockDisplayTitle(
  block: TransshipmentBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return toTransshipmentBlockCanonicalTitle(block, dependencies)
}

export function toTransshipmentHandoffSummary(
  block: TransshipmentBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string | null {
  if (block.handoffDisplayMode === 'FULL') {
    return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.vesselChangeDetail, {
      from: block.previousVesselName ?? '?',
      to: block.nextVesselName ?? '?',
    })
  }

  if (block.handoffDisplayMode === 'NEXT_ONLY' && block.nextVesselName !== null) {
    return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.vesselChangeNextOnly, {
      to: block.nextVesselName,
    })
  }

  return null
}

export function toPlannedTransshipmentBlockCanonicalTitle(
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.plannedTransshipment)
}

export function toPlannedTransshipmentBlockDisplayTitle(
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return toPlannedTransshipmentBlockCanonicalTitle(dependencies)
}

export function toPlannedTransshipmentHandoffSummary(
  block: PlannedTransshipmentBlock,
  dependencies: TimelineBlockPresentationDependencies,
): string | null {
  return toVesselHandoffSummary(block.fromVessel, block.toVessel, dependencies)
}

export function toTimelineMarkersBlockTitle(
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.markers)
}

export function toTimelineEventsBlockTitle(
  dependencies: TimelineBlockPresentationDependencies,
): string {
  return dependencies.t(dependencies.keys.shipmentView.timeline.blocks.events)
}
