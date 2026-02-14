import { describe, expect, it } from 'vitest'
import { resolveLocationDisplay } from '~/modules/tracking/application/locationDisplayResolver'

describe('resolveLocationDisplay', () => {
  it('should prefer location_display when available', () => {
    const result = resolveLocationDisplay({
      location_code: 'USNYC',
      location_display: 'New York, NY',
    })
    expect(result).toBe('New York, NY')
  })

  it('should fall back to location_code when location_display is null', () => {
    const result = resolveLocationDisplay({
      location_code: 'USNYC',
      location_display: null,
    })
    expect(result).toBe('USNYC')
  })

  it('should fall back to location_code when location_display is empty string', () => {
    const result = resolveLocationDisplay({
      location_code: 'USNYC',
      location_display: '',
    })
    expect(result).toBe('USNYC')
  })

  it('should fall back to location_code when location_display is whitespace only', () => {
    const result = resolveLocationDisplay({
      location_code: 'USNYC',
      location_display: '   ',
    })
    expect(result).toBe('USNYC')
  })

  it('should return "Unknown location" when both are null', () => {
    const result = resolveLocationDisplay({
      location_code: null,
      location_display: null,
    })
    expect(result).toBe('Unknown location')
  })

  it('should return "Unknown location" when both are empty', () => {
    const result = resolveLocationDisplay({
      location_code: '',
      location_display: '',
    })
    expect(result).toBe('Unknown location')
  })

  it('should return "Unknown location" when location_code is whitespace and location_display is null', () => {
    const result = resolveLocationDisplay({
      location_code: '   ',
      location_display: null,
    })
    expect(result).toBe('Unknown location')
  })

  it('should trim whitespace from location_display', () => {
    const result = resolveLocationDisplay({
      location_code: 'USNYC',
      location_display: '  New York, NY  ',
    })
    expect(result).toBe('New York, NY')
  })

  it('should trim whitespace from location_code', () => {
    const result = resolveLocationDisplay({
      location_code: '  USNYC  ',
      location_display: null,
    })
    expect(result).toBe('USNYC')
  })

  it('should preserve original casing from location_display', () => {
    const result = resolveLocationDisplay({
      location_code: 'USNYC',
      location_display: 'NeW YoRk',
    })
    expect(result).toBe('NeW YoRk')
  })

  it('should preserve original casing from location_code', () => {
    const result = resolveLocationDisplay({
      location_code: 'UsNyC',
      location_display: null,
    })
    expect(result).toBe('UsNyC')
  })
})
