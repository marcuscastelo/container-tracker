import { describe, expect, it } from 'vitest'
import { parseTrelloSmartPaste } from '~/modules/process/ui/validation/trelloSmartPaste.validation'

describe('trelloSmartPaste.validation', () => {
  it('parses title + labeled lines + global containers from a real Trello card payload', () => {
    const parsed = parseTrelloSmartPaste(`Título:
REF. CASTRO: CA074-25 - IMP: NACOM GOYA - EXP: FUTURE FOR FOOD - AZEITONA

Descrição:
NAVIO: CMA CGM LISA MARIE
PREVISÃO: 13/03/2026
CHEGADA:
BL: EG 0017057
CTNR: MRSU8798130 / CAAU7648798
ORIGEM: EGITO
PROFORMA:
INVOICE COMERCIAL: BZ 0016-BC
DEPOSITÁRIO: MOVECTA
REDESTINAÇÃO: 129495`)

    expect(parsed.fields.reference).toBe('CA074-25')
    expect(parsed.fields.importerName).toBe('NACOM GOYA')
    expect(parsed.fields.exporterName).toBe('FUTURE FOR FOOD')
    expect(parsed.fields.product).toBe('AZEITONA')
    expect(parsed.fields.origin).toBe('EGITO')
    expect(parsed.fields.destination).toBe('MOVECTA')
    expect(parsed.fields.billOfLading).toBe('EG 0017057')
    expect(parsed.fields.redestinationNumber).toBe('129495')
    expect(parsed.fields.containers).toEqual(['MRSU8798130', 'CAAU7648798'])

    expect(parsed.unmappedFields).toEqual([
      { label: 'NAVIO', value: 'CMA CGM LISA MARIE' },
      { label: 'PREVISÃO', value: '13/03/2026' },
      { label: 'CHEGADA', value: '' },
      { label: 'PROFORMA', value: '' },
      { label: 'INVOICE COMERCIAL', value: 'BZ 0016-BC' },
    ])

    expect(parsed.warnings).toContain('carrier_not_detected')
    expect(parsed.warnings).not.toContain('unmapped_field:NAVIO')
    expect(parsed.warnings).not.toContain('unmapped_field:PREVISÃO')
  })

  it('accepts label variations and container separators in CTNR line', () => {
    const parsed = parseTrelloSmartPaste(`REF.: XPTO-01
IMP: Importadora Brasil
EXP: Exportadora PT
CTNR: mrsu8798130, CAAU7648798; TGHU1234567`)

    expect(parsed.fields.reference).toBe('XPTO-01')
    expect(parsed.fields.importerName).toBe('Importadora Brasil')
    expect(parsed.fields.exporterName).toBe('Exportadora PT')
    expect(parsed.fields.containers).toEqual(['MRSU8798130', 'CAAU7648798', 'TGHU1234567'])
    expect(parsed.warnings).not.toContain('no_valid_container_found')
  })

  it('uses global container fallback when CTNR label is absent', () => {
    const parsed = parseTrelloSmartPaste(`Observações gerais
Container principal MRSU8798130
Reserva alternativa CAAU7648798`)

    expect(parsed.fields.containers).toEqual(['MRSU8798130', 'CAAU7648798'])
  })

  it('splits product and vessel when NAVIO is pasted without a line break after product', () => {
    const parsed = parseTrelloSmartPaste(`Título:
REF. CASTRO: CA075-25 - IMP: FLUSH - EXP: AL-HAMDOLILLAH - SAL

Descrição:
PRODUTO: SALNAVIO: GSL VIOLETTA
BL: MEDUP6124762
CTNR: MSCU1234567`)

    expect(parsed.fields.reference).toBe('CA075-25')
    expect(parsed.fields.importerName).toBe('FLUSH')
    expect(parsed.fields.exporterName).toBe('AL-HAMDOLILLAH')
    expect(parsed.fields.product).toBe('SAL')
    expect(parsed.fields.billOfLading).toBe('MEDUP6124762')
    expect(parsed.fields.containers).toEqual(['MSCU1234567'])
    expect(parsed.unmappedFields).toContainEqual({ label: 'NAVIO', value: 'GSL VIOLETTA' })
  })

  it('returns warning when no valid container can be found', () => {
    const parsed = parseTrelloSmartPaste(`REF: ABC-001
IMP: Empresa A
EXP: Empresa B
CTNR: SEM CONTAINER VÁLIDO`)

    expect(parsed.fields.containers).toEqual([])
    expect(parsed.warnings).toContain('no_valid_container_found')
  })
})
