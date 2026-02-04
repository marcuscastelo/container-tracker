import { describe, expect, it } from 'vitest'
import { carrierTrackUrl } from '~/shared/utils/carrier'

describe('carrierTrackUrl util', () => {
  it('returns maersk tracking URL when carrier includes maersk', () => {
    const url = carrierTrackUrl('Maersk Lines', 'MRKU1234567')
    expect(url).toContain('maersk.com')
  })

  it('returns msc tracking URL when carrier includes msc', () => {
    const url = carrierTrackUrl('MSC', 'MRKU1234567')
    expect(url).toContain('msc.com')
  })

  it('returns cma-cgm URL when carrier includes cma', () => {
    const url = carrierTrackUrl('CMA-CGM', 'MRKU1234567')
    expect(url).toContain('cma-cgm.com')
  })

  it('returns google search fallback for unknown carrier', () => {
    const url = carrierTrackUrl('Some Unknown Carrier', 'MRKU1234567')
    expect(url).toContain('google.com/search')
  })
})
