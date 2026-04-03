import { describe, expect, it } from 'vitest'
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'

describe('toCarrierDisplayLabel', () => {
  it('formats known carrier codes with stable UI labels', () => {
    expect(toCarrierDisplayLabel('maersk')).toBe('Maersk')
    expect(toCarrierDisplayLabel('MSC')).toBe('MSC')
    expect(toCarrierDisplayLabel('cmacgm')).toBe('CMA CGM')
    expect(toCarrierDisplayLabel('PIL')).toBe('PIL')
    expect(toCarrierDisplayLabel('one')).toBe('ONE')
  })

  it('recognizes common carrier aliases and recent providers', () => {
    expect(toCarrierDisplayLabel('Ocean Network Express')).toBe('ONE')
    expect(toCarrierDisplayLabel('HAPAG')).toBe('Hapag-Lloyd')
    expect(toCarrierDisplayLabel('evergreen line')).toBe('Evergreen')
  })

  it('renders the unknown sentinel predictably', () => {
    expect(toCarrierDisplayLabel('unknown')).toBe('UNKNOWN')
  })

  it('preserves unsupported carriers for audit-friendly display', () => {
    expect(toCarrierDisplayLabel('Custom Carrier')).toBe('Custom Carrier')
  })

  it('returns null for nullish or blank inputs', () => {
    expect(toCarrierDisplayLabel(null)).toBeNull()
    expect(toCarrierDisplayLabel(undefined)).toBeNull()
    expect(toCarrierDisplayLabel('   ')).toBeNull()
  })
})
