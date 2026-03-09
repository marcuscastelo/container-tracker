import type {
  TerminalSegmentKind,
  TimelineRenderItem,
} from '~/modules/process/ui/timeline/timelineBlockModel'

type CurrentVoyageEvent = {
  readonly type: string
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
}

export type CurrentVoyageGroup =
  | {
      readonly kind: 'voyage'
      readonly events: readonly CurrentVoyageEvent[]
    }
  | {
      readonly kind: 'terminal'
      readonly terminalKind: TerminalSegmentKind
      readonly events: readonly CurrentVoyageEvent[]
    }
  | {
      readonly kind: 'other'
    }

export type CurrentVoyageResolution = {
  readonly index: number
  readonly hasAnyActualVoyage: boolean
  readonly endedByPostCarriage: boolean
  readonly currentVoyageHasActualDischarge: boolean
}

export function toCurrentVoyageGroups(
  renderList: readonly TimelineRenderItem[],
): readonly CurrentVoyageGroup[] {
  const groups: CurrentVoyageGroup[] = []
  let i = 0

  while (i < renderList.length) {
    const item = renderList[i]

    if (item.type === 'voyage-block') {
      groups.push({ kind: 'voyage', events: item.block.events })
      i++
      while (i < renderList.length && renderList[i].type !== 'block-end') i++
      if (i < renderList.length && renderList[i].type === 'block-end') i++
      continue
    }

    if (item.type === 'terminal-block') {
      groups.push({
        kind: 'terminal',
        terminalKind: item.block.kind,
        events: item.block.events,
      })
      i++
      while (i < renderList.length && renderList[i].type !== 'block-end') i++
      if (i < renderList.length && renderList[i].type === 'block-end') i++
      continue
    }

    if (item.type !== 'block-end') {
      groups.push({ kind: 'other' })
    }

    i++
  }

  return groups
}

export function resolveCurrentVoyage(
  groups: readonly CurrentVoyageGroup[],
): CurrentVoyageResolution {
  let fallbackIdx = -1
  let fallbackHasActualDischarge = false

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    if (group.kind !== 'voyage') continue

    const hasActual = group.events.some((event) => event.eventTimeType === 'ACTUAL')
    if (!hasActual) continue

    fallbackIdx = i
    const hasActualDischarge = group.events.some(
      (event) => event.type === 'DISCHARGE' && event.eventTimeType === 'ACTUAL',
    )
    fallbackHasActualDischarge = hasActualDischarge
    if (!hasActualDischarge) {
      return {
        index: i,
        hasAnyActualVoyage: true,
        endedByPostCarriage: false,
        currentVoyageHasActualDischarge: false,
      }
    }
  }

  if (fallbackIdx < 0) {
    return {
      index: -1,
      hasAnyActualVoyage: false,
      endedByPostCarriage: false,
      currentVoyageHasActualDischarge: false,
    }
  }

  for (let i = fallbackIdx + 1; i < groups.length; i++) {
    const group = groups[i]
    if (group.kind !== 'terminal' || group.terminalKind !== 'post-carriage') continue
    if (group.events.some((event) => event.eventTimeType === 'ACTUAL')) {
      return {
        index: -1,
        hasAnyActualVoyage: true,
        endedByPostCarriage: true,
        currentVoyageHasActualDischarge: false,
      }
    }
  }

  return {
    index: fallbackIdx,
    hasAnyActualVoyage: true,
    endedByPostCarriage: false,
    currentVoyageHasActualDischarge: fallbackHasActualDischarge,
  }
}

export function resolveCurrentVoyageIndex(groups: readonly CurrentVoyageGroup[]): number {
  return resolveCurrentVoyage(groups).index
}
