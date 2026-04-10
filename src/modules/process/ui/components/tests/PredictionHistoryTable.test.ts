import { describe, expect, it } from 'vitest'
import {
  formatPredictionHistoryVoyageLabel,
  resolvePredictionHistoryChangeDisplay,
} from '~/modules/process/ui/components/PredictionHistoryTable'
import type { TrackingSeriesHistoryItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'

function makeHistoryItem(
  overrides: Partial<TrackingSeriesHistoryItem> = {},
): TrackingSeriesHistoryItem {
  return {
    id: overrides.id ?? 'history-1',
    type: overrides.type ?? 'DISCHARGE',
    event_time: overrides.event_time ?? { kind: 'date', value: '2026-03-28', timezone: null },
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    created_at: overrides.created_at ?? '2026-04-04T16:53:10.273469Z',
    seriesLabel: overrides.seriesLabel ?? 'CONFLICTING_ACTUAL',
    ...(overrides.vesselName === undefined
      ? { vesselName: 'MSC ARICA' }
      : { vesselName: overrides.vesselName }),
    ...(overrides.voyage === undefined ? { voyage: 'IV610A' } : { voyage: overrides.voyage }),
    ...(overrides.changeKind === undefined
      ? { changeKind: 'VOYAGE_CORRECTED_AFTER_CONFIRMATION' }
      : { changeKind: overrides.changeKind }),
  }
}

describe('PredictionHistoryTable', () => {
  it('formats vessel and voyage together for the voyage column', () => {
    expect(formatPredictionHistoryVoyageLabel(makeHistoryItem())).toBe('MSC ARICA / IV610A')
    expect(
      formatPredictionHistoryVoyageLabel(
        makeHistoryItem({
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          changeKind: null,
        }),
      ),
    ).toBe('MSC ARICA / OB610R')
  })

  it('prefers the backend-provided voyage correction label over delta-day text', () => {
    const display = resolvePredictionHistoryChangeDisplay({
      observation: makeHistoryItem(),
      deltaDays: 4,
      translateVoyageCorrection: () => 'Voyage corrigido após confirmação',
      translateDays: () => 'dias',
    })

    expect(display).toEqual({
      text: 'Voyage corrigido após confirmação',
      tone: 'warning',
    })
  })
})
