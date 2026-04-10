import { describe, expect, it } from 'vitest'
import {
  shouldShowTimelineCopyAction,
  type TimelineTextExportSource,
} from '~/modules/process/ui/screens/shipment/lib/serializeTimelineToText'

function makeExportSource(renderListLength: number): TimelineTextExportSource {
  return {
    mode: 'current',
    title: 'Timeline do Container',
    containerNumber: 'GLDU2928252',
    statusCode: 'IN_TRANSIT',
    statusLabel: 'Em Trânsito',
    eta: null,
    currentContext: {
      locationDisplay: 'KARACHI, PK',
      vesselName: 'MSC ARICA',
      voyage: 'OB610R',
      vesselVisible: true,
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    referenceNowIso: null,
    renderList:
      renderListLength === 0
        ? []
        : [
            {
              type: 'transshipment-block',
              block: {
                blockType: 'transshipment',
                mode: 'confirmed',
                port: 'COLOMBO, LK',
                reason: null,
                previousVesselName: 'MSC ARICA',
                previousVoyage: 'OB610R',
                nextVesselName: 'GSL VIOLETTA',
                nextVoyage: '2613W',
                handoffDisplayMode: 'FULL',
                events: [],
              },
            },
          ],
  }
}

describe('TimelinePanel copy action', () => {
  it('shows the copy action only when the export source has visible timeline content', () => {
    expect(shouldShowTimelineCopyAction(null)).toBe(false)
    expect(shouldShowTimelineCopyAction(makeExportSource(0))).toBe(false)
    expect(shouldShowTimelineCopyAction(makeExportSource(1))).toBe(true)
  })
})
