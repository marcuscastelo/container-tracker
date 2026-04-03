import { describe, expect, it } from 'vitest'
import {
  buildProcessCarrierOptions,
  toProcessDialogCarrier,
} from '~/modules/process/ui/carrierCatalog'

describe('buildProcessCarrierOptions', () => {
  it('includes ONE and keeps the dialog carrier list aligned with supported options', () => {
    const result = buildProcessCarrierOptions('Desconhecido')

    expect(result).toEqual([
      { value: 'maersk', label: 'Maersk' },
      { value: 'msc', label: 'MSC' },
      { value: 'cmacgm', label: 'CMA CGM' },
      { value: 'pil', label: 'PIL' },
      { value: 'one', label: 'ONE' },
      { value: 'hapag', label: 'Hapag-Lloyd' },
      { value: 'evergreen', label: 'Evergreen' },
      { value: 'unknown', label: 'Desconhecido' },
    ])
  })
})

describe('toProcessDialogCarrier', () => {
  it('normalizes legacy uppercase carriers for edit flows', () => {
    expect(toProcessDialogCarrier('ONE')).toBe('one')
    expect(toProcessDialogCarrier('PIL')).toBe('pil')
    expect(toProcessDialogCarrier('MSC')).toBe('msc')
  })

  it('maps common carrier display names back to dialog values', () => {
    expect(toProcessDialogCarrier('Ocean Network Express')).toBe('one')
    expect(toProcessDialogCarrier('Hapag-Lloyd')).toBe('hapag')
  })

  it('falls back to unknown for unsupported or blank carriers', () => {
    expect(toProcessDialogCarrier('')).toBe('unknown')
    expect(toProcessDialogCarrier('custom-carrier')).toBe('unknown')
    expect(toProcessDialogCarrier(null)).toBe('unknown')
  })
})
