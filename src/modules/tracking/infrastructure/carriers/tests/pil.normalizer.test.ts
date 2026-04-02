import { describe, expect, it } from 'vitest'
import { normalizePilSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/pil.normalizer'
import {
  makePilSnapshot,
  PIL_VALID_PAYLOAD,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/pil.fixture'
import { temporalCanonicalText } from '~/shared/time/tests/helpers'

describe('normalizePilSnapshot', () => {
  it('maps detailed PIL events into canonical observations and skips non-temporal rows', () => {
    const drafts = normalizePilSnapshot(makePilSnapshot(PIL_VALID_PAYLOAD))

    expect(drafts).toHaveLength(4)
    expect(drafts.map((draft) => draft.type)).toEqual(['GATE_OUT', 'GATE_IN', 'LOAD', 'DISCHARGE'])

    const gateIn = drafts.find((draft) => draft.type === 'GATE_IN')
    expect(gateIn?.vessel_name).toBeNull()
    expect(gateIn?.voyage).toBeNull()
    expect(gateIn?.location_display).toBe('QINGDAO')
    expect(gateIn?.location_code).toBeNull()

    const load = drafts.find((draft) => draft.type === 'LOAD')
    expect(load?.carrier_label).toBe('Vessel Loading')
    expect(load?.vessel_name).toBe('CMA CGM KRYPTON')
    expect(load?.voyage).toBe('VCGK0001W')
    expect(temporalCanonicalText(load?.event_time ?? null)).toBe(
      '2026-03-14T04:10:00.000[Asia/Shanghai]',
    )
    expect(load?.event_time_source).toBe('carrier_local_port_time')

    const discharge = drafts.find((draft) => draft.type === 'DISCHARGE')
    expect(discharge?.event_time_type).toBe('EXPECTED')
    expect(discharge?.location_display).toBe('SANTOS')
    expect(discharge?.location_code).toBeNull()
    expect(temporalCanonicalText(discharge?.event_time ?? null)).toBe(
      '2026-04-23T19:00:00.000[America/Sao_Paulo]',
    )
    expect(discharge?.event_time_source).toBe('carrier_local_port_time')
  })

  it('maps unknown carrier events to OTHER and preserves the original carrier_label', () => {
    const payload = {
      ...PIL_VALID_PAYLOAD,
      data: PIL_VALID_PAYLOAD.data.replace('Vessel Loading', 'Custom Carrier Milestone'),
    }

    const drafts = normalizePilSnapshot(makePilSnapshot(payload))
    const other = drafts.find((draft) => draft.carrier_label === 'Custom Carrier Milestone')

    expect(other?.type).toBe('OTHER')
    expect(other?.provider).toBe('pil')
    expect(other?.location_display).toBe('QINGDAO')
  })
})
