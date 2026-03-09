import { describe, expect, it } from 'vitest'
import {
  type CurrentVoyageGroup,
  resolveCurrentVoyageIndex,
} from '~/modules/process/ui/timeline/currentVoyage'

function voyageGroup(
  events: readonly { readonly type: string; readonly eventTimeType: 'ACTUAL' | 'EXPECTED' }[],
): CurrentVoyageGroup {
  return { kind: 'voyage', events }
}

function postCarriageGroup(
  events: readonly { readonly type: string; readonly eventTimeType: 'ACTUAL' | 'EXPECTED' }[],
): CurrentVoyageGroup {
  return {
    kind: 'terminal',
    terminalKind: 'post-carriage',
    events,
  }
}

describe('resolveCurrentVoyageIndex', () => {
  it('returns -1 when post-carriage has ACTUAL events after the last ACTUAL voyage', () => {
    const groups: readonly CurrentVoyageGroup[] = [
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DISCHARGE', eventTimeType: 'ACTUAL' },
      ]),
      postCarriageGroup([{ type: 'GATE_OUT', eventTimeType: 'ACTUAL' }]),
    ]

    expect(resolveCurrentVoyageIndex(groups)).toBe(-1)
  })

  it('returns the active voyage index when a voyage has ACTUAL events without ACTUAL DISCHARGE', () => {
    const groups: readonly CurrentVoyageGroup[] = [
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DISCHARGE', eventTimeType: 'ACTUAL' },
      ]),
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DEPARTURE', eventTimeType: 'ACTUAL' },
      ]),
    ]

    expect(resolveCurrentVoyageIndex(groups)).toBe(1)
  })

  it('keeps fallback to last ACTUAL voyage when post-carriage has no ACTUAL events', () => {
    const groups: readonly CurrentVoyageGroup[] = [
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DISCHARGE', eventTimeType: 'ACTUAL' },
      ]),
      postCarriageGroup([{ type: 'GATE_OUT', eventTimeType: 'EXPECTED' }]),
    ]

    expect(resolveCurrentVoyageIndex(groups)).toBe(0)
  })
})
