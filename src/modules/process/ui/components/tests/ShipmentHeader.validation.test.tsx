import { describe, expect, it } from 'vitest'
import { resolveShipmentTrackingValidationBannerDescription } from '~/modules/process/ui/components/shipment-header-tracking-review.presenter'

function createTranslate() {
  return (key: string, options?: Record<string, unknown>): string => {
    switch (key) {
      case 'shipmentView.validation.bannerDescriptionSingle':
        return 'A leitura atual requer validação em 1 container.'
      case 'shipmentView.validation.bannerDescriptionMultiple':
        return `A leitura atual requer validação em ${options?.count} containers.`
      case 'shipmentView.validation.historicalBannerDescription':
        return `O snapshot selecionado do container ${options?.container} requer validação.`
      default:
        return key
    }
  }
}

describe('ShipmentHeader.validation', () => {
  it('keeps current shipment banner copy singular without fallback punctuation tricks', () => {
    expect(
      resolveShipmentTrackingValidationBannerDescription({
        trackingValidationMode: 'current',
        affectedContainerCount: 1,
        historicalContainerNumber: null,
        translate: createTranslate(),
        unknownContainerLabel: 'Desconhecido',
      }),
    ).toBe('A leitura atual requer validação em 1 container.')
  })

  it('keeps current shipment banner copy plural for multiple affected containers', () => {
    expect(
      resolveShipmentTrackingValidationBannerDescription({
        trackingValidationMode: 'current',
        affectedContainerCount: 3,
        historicalContainerNumber: null,
        translate: createTranslate(),
        unknownContainerLabel: 'Desconhecido',
      }),
    ).toBe('A leitura atual requer validação em 3 containers.')
  })

  it('keeps historical shipment banner copy container-specific', () => {
    expect(
      resolveShipmentTrackingValidationBannerDescription({
        trackingValidationMode: 'historical',
        affectedContainerCount: 1,
        historicalContainerNumber: 'MSCU1234567',
        translate: createTranslate(),
        unknownContainerLabel: 'Desconhecido',
      }),
    ).toBe('O snapshot selecionado do container MSCU1234567 requer validação.')
  })
})
