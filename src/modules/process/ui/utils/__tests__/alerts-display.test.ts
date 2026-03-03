import { describe, expect, it } from 'vitest'
import { toVisibleAlertsBySelectedContainer } from '~/modules/process/ui/utils/alerts-display'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

function createContainer(hasTransshipment: boolean): ContainerDetailVM {
  return {
    id: 'container-1',
    number: 'MSCU1234567',
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    eta: null,
    etaChipVm: {
      state: 'UNAVAILABLE',
      tone: 'neutral',
      date: null,
    },
    selectedEtaVm: null,
    tsChipVm: {
      visible: hasTransshipment,
      count: hasTransshipment ? 2 : 0,
      portsTooltip: hasTransshipment ? 'EGPSDTM, ESBCN07' : null,
    },
    dataIssueChipVm: {
      visible: false,
    },
    transshipment: {
      hasTransshipment,
      count: hasTransshipment ? 2 : 0,
      ports: hasTransshipment
        ? [
            { code: 'EGPSDTM', display: 'Port Said' },
            { code: 'ESBCN07', display: 'Barcelona' },
          ]
        : [],
    },
    timeline: [],
  }
}

describe('toVisibleAlertsBySelectedContainer', () => {
  it('hides legacy transshipment alerts when transshipment card is visible', () => {
    const selectedContainer = createContainer(true)
    const alerts: readonly AlertDisplayVM[] = [
      {
        id: 'a-1',
        type: 'transshipment',
        severity: 'warning',
        message: 'Transshipment detected: 2 intermediate port(s)',
        timestamp: 'agora',
        triggeredAtIso: '2026-03-01T10:00:00.000Z',
        category: 'fact',
        retroactive: false,
      },
      {
        id: 'a-2',
        type: 'info',
        severity: 'info',
        message: 'Payload parse warning',
        timestamp: 'agora',
        triggeredAtIso: '2026-03-01T10:00:00.000Z',
        category: 'monitoring',
        retroactive: false,
      },
    ]

    const result = toVisibleAlertsBySelectedContainer(alerts, selectedContainer)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a-2')
  })

  it('keeps alerts unchanged when selected container has no transshipment card', () => {
    const selectedContainer = createContainer(false)
    const alerts: readonly AlertDisplayVM[] = [
      {
        id: 'a-1',
        type: 'transshipment',
        severity: 'warning',
        message: 'Transshipment detected: 2 intermediate port(s)',
        timestamp: 'agora',
        triggeredAtIso: '2026-03-01T10:00:00.000Z',
        category: 'fact',
        retroactive: false,
      },
    ]

    const result = toVisibleAlertsBySelectedContainer(alerts, selectedContainer)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a-1')
  })
})
