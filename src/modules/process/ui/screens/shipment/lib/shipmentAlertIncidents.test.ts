import { describe, expect, it } from 'vitest'
import {
  toAlertsPanelEmptyStateKind,
  toDuplicateTransshipmentIncidentKeys,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlertIncidents'
import type { AlertIncidentVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'

function makeTransshipmentIncident(command: {
  readonly incidentKey: string
  readonly port: string
  readonly fromVessel: string
  readonly toVessel: string
  readonly transshipmentOrder: number
}): AlertIncidentVM {
  return {
    incidentKey: command.incidentKey,
    bucket: 'active',
    category: 'movement',
    type: 'TRANSSHIPMENT',
    severity: 'warning',
    messageKey: 'incidents.fact.transshipmentDetected',
    messageParams: {
      port: command.port,
      fromVessel: command.fromVessel,
      toVessel: command.toVessel,
    },
    action: {
      actionKey: 'incidents.action.updateRedestination',
      actionParams: {},
      actionKind: 'UPDATE_REDESTINATION',
    },
    detectedAtIso: '2026-02-28T00:00:00.000Z',
    triggeredAtIso: '2026-04-01T10:00:00.000Z',
    transshipmentOrder: command.transshipmentOrder,
    port: command.port,
    fromVessel: command.fromVessel,
    toVessel: command.toVessel,
    affectedContainerCount: 1,
    activeAlertIds: ['alert-1'],
    ackedAlertIds: [],
    members: [],
  }
}

describe('shipmentAlertIncidents helpers', () => {
  it('returns activeEmpty when there are no active incidents at all', () => {
    expect(
      toAlertsPanelEmptyStateKind({
        hasVisibleActiveIncidents: false,
        hasAnyActiveIncidents: false,
      }),
    ).toBe('activeEmpty')
  })

  it('returns emptyFiltered only when active incidents exist but are hidden by the filter', () => {
    expect(
      toAlertsPanelEmptyStateKind({
        hasVisibleActiveIncidents: false,
        hasAnyActiveIncidents: true,
      }),
    ).toBe('emptyFiltered')
  })

  it('marks duplicated transshipment routes so the UI can disambiguate repeated occurrences', () => {
    const duplicatedKeys = toDuplicateTransshipmentIncidentKeys([
      makeTransshipmentIncident({
        incidentKey: 'TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
        port: 'KRPUS',
        fromVessel: 'MSC IRIS',
        toVessel: 'MSC BIANCA SILVIA',
        transshipmentOrder: 1,
      }),
      makeTransshipmentIncident({
        incidentKey: 'TRANSSHIPMENT:2:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
        port: 'KRPUS',
        fromVessel: 'MSC IRIS',
        toVessel: 'MSC BIANCA SILVIA',
        transshipmentOrder: 2,
      }),
      makeTransshipmentIncident({
        incidentKey: 'TRANSSHIPMENT:1:SGSIN:MSC BIANCA SILVIA:FEEDER XYZ',
        port: 'SGSIN',
        fromVessel: 'MSC BIANCA SILVIA',
        toVessel: 'FEEDER XYZ',
        transshipmentOrder: 1,
      }),
    ])

    expect([...duplicatedKeys].sort()).toEqual([
      'TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
      'TRANSSHIPMENT:2:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
    ])
  })
})
