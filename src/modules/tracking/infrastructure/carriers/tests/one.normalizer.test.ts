import { describe, expect, it, vi } from 'vitest'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { buildTimelineRenderList } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeOneSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/one.normalizer'
import {
  makeOneRawPayload,
  makeOneSnapshot,
  ONE_CONTAINER_ID,
  ONE_COP_EVENTS_FIXTURE,
  ONE_SAMPLE_CONTAINER_NUMBER,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/one.fixture'
import { instantFromIsoText, temporalCanonicalText } from '~/shared/time/tests/helpers'

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected value to be defined in test fixture')
  }

  return value
}

function toObservation(
  draft: ReturnType<typeof normalizeOneSnapshot>[number],
  index: number,
): Observation {
  return {
    id: `obs-${index + 1}`,
    fingerprint: `fp-${index + 1}`,
    container_id: ONE_CONTAINER_ID,
    container_number: draft.container_number,
    type: draft.type,
    event_time: draft.event_time,
    event_time_type: draft.event_time_type,
    location_code: draft.location_code,
    location_display: draft.location_display,
    vessel_name: draft.vessel_name,
    voyage: draft.voyage,
    is_empty: draft.is_empty,
    confidence: draft.confidence,
    provider: draft.provider,
    created_from_snapshot_id: draft.snapshot_id,
    carrier_label: draft.carrier_label ?? null,
    created_at: `2026-04-02T12:${String(index).padStart(2, '0')}:00.000Z`,
  }
}

function toVoyageBlocks(
  renderList: ReturnType<typeof buildTimelineRenderList>,
): Extract<
  ReturnType<typeof buildTimelineRenderList>[number],
  { readonly type: 'voyage-block' }
>[] {
  return renderList.filter(
    (
      item,
    ): item is Extract<
      ReturnType<typeof buildTimelineRenderList>[number],
      { readonly type: 'voyage-block' }
    > => item.type === 'voyage-block',
  )
}

function toTransshipmentBlocks(
  renderList: ReturnType<typeof buildTimelineRenderList>,
): Extract<
  ReturnType<typeof buildTimelineRenderList>[number],
  { readonly type: 'transshipment-block' }
>[] {
  return renderList.filter(
    (
      item,
    ): item is Extract<
      ReturnType<typeof buildTimelineRenderList>[number],
      { readonly type: 'transshipment-block' }
    > => item.type === 'transshipment-block',
  )
}

function rawEventSource(draft: ReturnType<typeof normalizeOneSnapshot>[number]): string | null {
  const rawEvent = draft.raw_event
  if (typeof rawEvent !== 'object' || rawEvent === null || Array.isArray(rawEvent)) {
    return null
  }

  if (!('source' in rawEvent)) {
    return null
  }

  const source = rawEvent.source
  return typeof source === 'string' ? source : null
}

describe('normalizeOneSnapshot', () => {
  it('normalizes the consolidated ONE snapshot into 12 COP-driven observation drafts', () => {
    const drafts = normalizeOneSnapshot(makeOneSnapshot(makeOneRawPayload()))

    expect(drafts).toHaveLength(12)
    expect(drafts.map((draft) => draft.type)).toEqual([
      'GATE_OUT',
      'GATE_IN',
      'LOAD',
      'DEPARTURE',
      'ARRIVAL',
      'DISCHARGE',
      'LOAD',
      'DEPARTURE',
      'ARRIVAL',
      'DISCHARGE',
      'GATE_OUT',
      'EMPTY_RETURN',
    ])
  })

  it('maps ACTUAL and ESTIMATED trigger types onto canonical event_time_type values', () => {
    const drafts = normalizeOneSnapshot(makeOneSnapshot(makeOneRawPayload()))

    expect(drafts[0]?.event_time_type).toBe('ACTUAL')
    expect(drafts[7]?.event_time_type).toBe('ACTUAL')
    expect(drafts[8]?.event_time_type).toBe('EXPECTED')
    expect(drafts[11]?.event_time_type).toBe('EXPECTED')
  })

  it('prefers local-port temporal semantics and enriches vessel legs across transshipment', () => {
    const drafts = normalizeOneSnapshot(makeOneSnapshot(makeOneRawPayload()))

    const singaporeArrival = drafts.find(
      (draft) => draft.carrier_label === 'Vessel Arrival at T/S Port',
    )
    const karachiDeparture = drafts.find(
      (draft) => draft.carrier_label === 'Vessel Departure from Port of Loading',
    )
    const transshipmentDeparture = drafts.find(
      (draft) => draft.carrier_label === 'Departure from Transshipment Port',
    )

    expect(temporalCanonicalText(singaporeArrival?.event_time ?? null)).toBe(
      '2026-03-11T20:25:00.000[Asia/Singapore]',
    )
    expect(karachiDeparture?.vessel_name).toBe('CARL SCHULTE')
    expect(karachiDeparture?.voyage).toBe('0009E')
    expect(transshipmentDeparture?.vessel_name).toBe('PARANA EXPRESS')
    expect(transshipmentDeparture?.voyage).toBe('2610W')
  })

  it('does not double-ingest search.cargoEvents when COP events are present', () => {
    const drafts = normalizeOneSnapshot(makeOneSnapshot(makeOneRawPayload()))

    expect(drafts).toHaveLength(12)
    expect(drafts.some((draft) => rawEventSource(draft) === 'search.cargoEvents')).toBe(false)
  })

  it('falls back to search.cargoEvents when COP events are missing and keeps only confirmed matrix ids', () => {
    const drafts = normalizeOneSnapshot(
      makeOneSnapshot(
        makeOneRawPayload({
          copEvents: null,
          copEventsMeta: {
            ok: false,
            statusCode: null,
            error: 'ONE cop-events unavailable',
            receivedCount: null,
          },
        }),
      ),
    )

    expect(drafts).toHaveLength(2)
    expect(drafts.map((draft) => draft.type)).toEqual(['DEPARTURE', 'ARRIVAL'])
    expect(drafts.map((draft) => draft.location_code)).toEqual(['PKKHI', 'BRSSZ'])
    expect(drafts.every((draft) => rawEventSource(draft) === 'search.cargoEvents')).toBe(true)
  })

  it('keeps unknown COP matrix ids as OTHER without changing status or alerts', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const now = instantFromIsoText('2026-04-02T12:00:00.000Z')

    const baselineDrafts = normalizeOneSnapshot(makeOneSnapshot(makeOneRawPayload()))
    const baselineObservations = baselineDrafts.map(toObservation)
    const baselineTimeline = deriveTimeline(
      ONE_CONTAINER_ID,
      ONE_SAMPLE_CONTAINER_NUMBER,
      baselineObservations,
      now,
    )
    const baselineStatus = deriveStatus(baselineTimeline)
    const baselineAlerts = deriveAlerts(baselineTimeline, baselineStatus, [], false, now)

    const payloadWithUnknown = makeOneRawPayload({
      copEvents: {
        ...ONE_COP_EVENTS_FIXTURE,
        data: [
          ...ONE_COP_EVENTS_FIXTURE.data,
          {
            ...requireDefined(ONE_COP_EVENTS_FIXTURE.data[7]),
            matrixId: 'E999',
            eventName: 'Carrier Custom Milestone',
            eventDate: '2026-04-15T10:00:00.000Z',
            eventLocalPortDate: '2026-04-15T18:00:00.000Z',
            triggerType: 'ESTIMATED',
            copSequence: 9999,
            vessel: null,
            edhVessel: null,
          },
        ],
      },
      copEventsMeta: {
        ok: true,
        statusCode: 200,
        error: null,
        receivedCount: 13,
      },
    })

    const mutatedDrafts = normalizeOneSnapshot(makeOneSnapshot(payloadWithUnknown))
    const otherDraft = mutatedDrafts.find(
      (draft) => draft.type === 'OTHER' && draft.carrier_label === 'Carrier Custom Milestone',
    )
    const mutatedObservations = mutatedDrafts.map(toObservation)
    const mutatedTimeline = deriveTimeline(
      ONE_CONTAINER_ID,
      ONE_SAMPLE_CONTAINER_NUMBER,
      mutatedObservations,
      now,
    )
    const mutatedStatus = deriveStatus(mutatedTimeline)
    const mutatedAlerts = deriveAlerts(mutatedTimeline, mutatedStatus, [], false, now)

    expect(otherDraft).toBeDefined()
    expect(mutatedStatus).toBe(baselineStatus)
    expect(mutatedAlerts).toEqual(baselineAlerts)

    warnSpy.mockRestore()
  })

  it('keeps the derived shipment state IN_TRANSIT and exposes voyage/transshipment blocks for Karachi to Santos', () => {
    const drafts = normalizeOneSnapshot(makeOneSnapshot(makeOneRawPayload()))
    const observations = drafts.map(toObservation)
    const now = instantFromIsoText('2026-04-02T12:00:00.000Z')
    const timeline = deriveTimeline(
      ONE_CONTAINER_ID,
      ONE_SAMPLE_CONTAINER_NUMBER,
      observations,
      now,
    )
    const status = deriveStatus(timeline)

    const projections = toTrackingObservationProjections(observations)
    const timelineItems = deriveTimelineWithSeriesReadModel(projections, now)
    const renderList = buildTimelineRenderList(timelineItems, now)
    const voyageBlocks = toVoyageBlocks(renderList)
    const transshipmentBlocks = toTransshipmentBlocks(renderList)
    const santosExpectedTypes = timelineItems
      .filter((item) => item.location === 'SANTOS, BRAZIL' && item.eventTimeType === 'EXPECTED')
      .map((item) => item.type)

    expect(status).toBe('IN_TRANSIT')
    expect(voyageBlocks).toHaveLength(2)
    expect(voyageBlocks[0]?.block.vessel).toBe('CARL SCHULTE')
    expect(voyageBlocks[0]?.block.origin).toBe('KARACHI, PAKISTAN')
    expect(voyageBlocks[0]?.block.destination).toBe('SINGAPORE, SINGAPORE')
    expect(voyageBlocks[1]?.block.vessel).toBe('PARANA EXPRESS')
    expect(voyageBlocks[1]?.block.origin).toBe('SINGAPORE, SINGAPORE')
    expect(voyageBlocks[1]?.block.destination).toBe('SANTOS, BRAZIL')
    expect(transshipmentBlocks).toHaveLength(1)
    expect(transshipmentBlocks[0]?.block.fromVessel).toBe('CARL SCHULTE')
    expect(transshipmentBlocks[0]?.block.toVessel).toBe('PARANA EXPRESS')
    expect(transshipmentBlocks[0]?.block.port).toBe('SINGAPORE, SINGAPORE')
    expect(santosExpectedTypes).toEqual(['ARRIVAL', 'DISCHARGE', 'GATE_OUT', 'EMPTY_RETURN'])
  })
})
