import { describe, expect, it } from 'vitest'
import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'

describe('normalizeVesselName', () => {
  it('returns null for nullish or whitespace-only values', () => {
    expect(normalizeVesselName(null)).toBeNull()
    expect(normalizeVesselName(undefined)).toBeNull()
    expect(normalizeVesselName('   ')).toBeNull()
  })

  it('trims and uppercases vessel names for semantic comparison', () => {
    expect(normalizeVesselName(' Maersk Aurora ')).toBe('MAERSK AURORA')
    expect(normalizeVesselName('msc bianca silvia')).toBe('MSC BIANCA SILVIA')
  })

  it('treats casing-only differences as equivalent', () => {
    expect(normalizeVesselName('MAERSK')).toBe(normalizeVesselName('Maersk'))
  })
})
