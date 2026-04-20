import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-solid', () => ({
  Construction: () => null,
  EyeIcon: () => null,
  Hourglass: () => null,
  Repeat: () => null,
  Ship: () => null,
  TriangleAlert: () => null,
  Truck: () => null,
}))

import {
  PlannedTransshipmentBlockCard,
  TransshipmentBlockCard,
} from '~/modules/process/ui/timeline/TimelineBlocks'
import type {
  PlannedTransshipmentBlock,
  TransshipmentBlock,
} from '~/modules/process/ui/timeline/timelineBlockModel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function makeTimelineItem(overrides: {
  readonly id: string
  readonly type: TrackingTimelineItem['type']
  readonly eventTimeType?: 'ACTUAL' | 'EXPECTED'
}): TrackingTimelineItem {
  const eventTimeType = overrides.eventTimeType ?? 'ACTUAL'

  return {
    id: overrides.id,
    type: overrides.type,
    eventTime: temporalDtoFromCanonical('2026-04-10T10:00:00.000Z'),
    eventTimeType,
    derivedState: eventTimeType === 'ACTUAL' ? 'ACTUAL' : 'ACTIVE_EXPECTED',
    location: 'Colombo, LK',
  }
}

function renderConfirmedBlock(block: TransshipmentBlock): string {
  return renderToString(() =>
    createComponent(TransshipmentBlockCard, {
      block,
      containerId: null,
      carrier: null,
      containerNumber: null,
    }),
  )
}

function renderPlannedBlock(block: PlannedTransshipmentBlock): string {
  return renderToString(() => createComponent(PlannedTransshipmentBlockCard, { block }))
}

describe('TransshipmentBlockCard', () => {
  it('keeps confirmed transshipment warning-card styling', () => {
    const html = renderConfirmedBlock({
      blockType: 'transshipment',
      mode: 'confirmed',
      port: 'COLOMBO, LK',
      reason: null,
      previousVesselName: 'MSC ARICA',
      previousVoyage: 'OB610R',
      nextVesselName: 'GSL VIOLETTA',
      nextVoyage: '2613W',
      handoffDisplayMode: 'FULL',
      events: [makeTimelineItem({ id: 'evt-confirmed', type: 'DISCHARGE' })],
    })

    expect(html).toContain('rounded-xl border border-tone-warning-border bg-tone-warning-bg')
    expect(html).toContain('Transbordo')
    expect(html).toContain('COLOMBO, LK')
  })

  it('keeps planned transshipment block styling and expected label', () => {
    const html = renderPlannedBlock({
      blockType: 'planned-transshipment',
      port: 'SINGAPORE, SG',
      event: makeTimelineItem({
        id: 'evt-planned',
        type: 'TRANSSHIPMENT_INTENDED',
        eventTimeType: 'EXPECTED',
      }),
      fromVessel: 'MSC ARICA',
      fromVoyage: 'OB610R',
      toVessel: 'SAO PAULO EXPRESS',
      toVoyage: '2613W',
    })

    expect(html).toContain('rounded-xl border border-tone-info-border bg-tone-info-bg/40')
    expect(html).toContain('Transbordo Planejado')
    expect(html).toContain('Previsto')
  })
})
