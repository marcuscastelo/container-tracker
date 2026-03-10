import { describe, expect, it, vi } from 'vitest'

const mockedIcons = vi.hoisted(() => ({
  Anchor: () => null,
  Download: () => null,
  LogIn: () => null,
  LogOut: () => null,
  RotateCcw: () => null,
  Sailboat: () => null,
  ShieldAlert: () => null,
  ShieldCheck: () => null,
  Truck: () => null,
  Upload: () => null,
}))

vi.mock('lucide-solid', () => mockedIcons)

import { timelineEventIcon } from '~/modules/process/ui/timeline/timelineEventIcon'

type IconCase = {
  readonly eventType: string
  readonly expected: () => null
}

const CASES: readonly IconCase[] = [
  { eventType: 'GATE_IN', expected: mockedIcons.LogIn },
  { eventType: 'GATE_OUT', expected: mockedIcons.LogOut },
  { eventType: 'LOAD', expected: mockedIcons.Upload },
  { eventType: 'DEPARTURE', expected: mockedIcons.Sailboat },
  { eventType: 'ARRIVAL', expected: mockedIcons.Anchor },
  { eventType: 'DISCHARGE', expected: mockedIcons.Download },
  { eventType: 'DELIVERY', expected: mockedIcons.Truck },
  { eventType: 'EMPTY_RETURN', expected: mockedIcons.RotateCcw },
  { eventType: 'CUSTOMS_HOLD', expected: mockedIcons.ShieldAlert },
  { eventType: 'CUSTOMS_RELEASE', expected: mockedIcons.ShieldCheck },
]

describe('timelineEventIcon', () => {
  for (const testCase of CASES) {
    it(`returns mapped icon for ${testCase.eventType}`, () => {
      expect(timelineEventIcon(testCase.eventType)).toBe(testCase.expected)
    })
  }

  it('returns undefined for unknown event types', () => {
    expect(timelineEventIcon('OTHER')).toBeUndefined()
    expect(timelineEventIcon('UNMAPPED_TYPE')).toBeUndefined()
  })
})
