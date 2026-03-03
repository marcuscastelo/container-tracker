import { describe, expect, it } from 'vitest'
import { resolveTimelineEventLabel } from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'

const keys = {
  shipmentView: {
    timeline: {
      systemCreated: 'shipmentView.timeline.systemCreated',
      unknownEvent: 'shipmentView.timeline.unknownEvent',
    },
  },
  tracking: {
    observationType: {
      GATE_IN: 'tracking.observationType.GATE_IN',
      GATE_OUT: 'tracking.observationType.GATE_OUT',
      LOAD: 'tracking.observationType.LOAD',
      DEPARTURE: 'tracking.observationType.DEPARTURE',
      ARRIVAL: 'tracking.observationType.ARRIVAL',
      DISCHARGE: 'tracking.observationType.DISCHARGE',
      DELIVERY: 'tracking.observationType.DELIVERY',
      EMPTY_RETURN: 'tracking.observationType.EMPTY_RETURN',
      CUSTOMS_HOLD: 'tracking.observationType.CUSTOMS_HOLD',
      CUSTOMS_RELEASE: 'tracking.observationType.CUSTOMS_RELEASE',
    },
  },
}

const translations: Record<string, string> = {
  [keys.shipmentView.timeline.systemCreated]: 'Processo registrado no sistema',
  [keys.shipmentView.timeline.unknownEvent]: 'Evento desconhecido',
  [keys.tracking.observationType.GATE_IN]: 'Entrada no Terminal',
  [keys.tracking.observationType.GATE_OUT]: 'Saida do Terminal',
  [keys.tracking.observationType.LOAD]: 'Carregado no Navio',
  [keys.tracking.observationType.DEPARTURE]: 'Navio Partiu',
  [keys.tracking.observationType.ARRIVAL]: 'Chegada ao Porto',
  [keys.tracking.observationType.DISCHARGE]: 'Descarregado do Navio',
  [keys.tracking.observationType.DELIVERY]: 'Entregue',
  [keys.tracking.observationType.EMPTY_RETURN]: 'Vazio Devolvido',
  [keys.tracking.observationType.CUSTOMS_HOLD]: 'Retencao Alfandegaria',
  [keys.tracking.observationType.CUSTOMS_RELEASE]: 'Liberacao Alfandegaria',
}

function t(key: string): string {
  return translations[key] ?? key
}

describe('resolveTimelineEventLabel', () => {
  it('prefers canonical translation when event type is known', () => {
    const label = resolveTimelineEventLabel(
      {
        type: 'LOAD',
        carrierLabel: 'Container loaded at terminal',
      },
      t,
      keys,
    )

    expect(label).toBe('Carregado no Navio')
  })

  it('uses canonical translation for system-created placeholder events', () => {
    const label = resolveTimelineEventLabel(
      {
        type: 'SYSTEM_CREATED',
      },
      t,
      keys,
    )

    expect(label).toBe('Processo registrado no sistema')
  })

  it('uses carrierLabel when canonical label is unavailable', () => {
    const label = resolveTimelineEventLabel(
      {
        type: 'OTHER',
        carrierLabel: 'Carrier free-text event',
      },
      t,
      keys,
    )

    expect(label).toBe('Carrier free-text event')
  })

  it('falls back to unknown-event label when both canonical and carrier labels are unavailable', () => {
    const label = resolveTimelineEventLabel(
      {
        type: 'OTHER',
      },
      t,
      keys,
    )

    expect(label).toBe('Evento desconhecido')
  })

  it('ignores blank carrier labels and uses unknown-event fallback', () => {
    const label = resolveTimelineEventLabel(
      {
        type: 'UNMAPPED_TYPE',
        carrierLabel: '   ',
      },
      t,
      keys,
    )

    expect(label).toBe('Evento desconhecido')
  })
})
