export type ShipmentHeaderTranslate = (key: string, options?: Record<string, unknown>) => string

export function resolveShipmentTrackingValidationBannerDescription(command: {
  readonly trackingValidationMode?: 'current' | 'historical' | undefined
  readonly affectedContainerCount: number
  readonly historicalContainerNumber?: string | null | undefined
  readonly translate: ShipmentHeaderTranslate
  readonly unknownContainerLabel: string
}): string {
  if (command.trackingValidationMode === 'historical') {
    return command.translate('shipmentView.validation.historicalBannerDescription', {
      container: command.historicalContainerNumber ?? command.unknownContainerLabel,
    })
  }

  if (command.affectedContainerCount === 1) {
    return command.translate('shipmentView.validation.bannerDescriptionSingle')
  }

  return command.translate('shipmentView.validation.bannerDescriptionMultiple', {
    count: command.affectedContainerCount,
  })
}
