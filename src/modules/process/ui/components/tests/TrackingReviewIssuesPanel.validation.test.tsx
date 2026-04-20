import { describe, expect, it } from 'vitest'
import { resolveTrackingValidationDetailsDescription } from '~/modules/process/ui/components/TrackingReviewIssuesPanel'

function createTranslate() {
  return (key: string, options?: Record<string, unknown>): string => {
    switch (key) {
      case 'shipmentView.validation.detailsDescription':
        return `Confira abaixo por que o container ${options?.container} requer validação agora e onde revisar a inconsistência.`
      case 'shipmentView.validation.historicalDetailsDescription':
        return `Confira abaixo por que o snapshot histórico do container ${options?.container} exigia validação neste momento.`
      default:
        return key
    }
  }
}

describe('TrackingReviewIssuesPanel.validation', () => {
  it('keeps current details copy container-specific', () => {
    expect(
      resolveTrackingValidationDetailsDescription({
        mode: 'current',
        containerNumber: 'MSCU1234567',
        translate: createTranslate(),
        unknownContainerLabel: 'Desconhecido',
      }),
    ).toBe(
      'Confira abaixo por que o container MSCU1234567 requer validação agora e onde revisar a inconsistência.',
    )
  })

  it('keeps historical details copy distinct from current mode', () => {
    expect(
      resolveTrackingValidationDetailsDescription({
        mode: 'historical',
        containerNumber: 'MSCU1234567',
        translate: createTranslate(),
        unknownContainerLabel: 'Desconhecido',
      }),
    ).toBe(
      'Confira abaixo por que o snapshot histórico do container MSCU1234567 exigia validação neste momento.',
    )
  })
})
