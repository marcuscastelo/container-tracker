import { normalizeCarrierKey } from '~/shared/utils/carrierDisplay'

const ONE_CARRIER_KEYS = new Set(['one', 'oneline', 'oceannetworkexpress'])

// Carrier tracking URL helpers
export function directCarrierTrackUrl(
  carrier: string | null,
  containerNumber: string,
): string | null {
  if (!carrier || !containerNumber) return null
  const c = carrier.toLowerCase()
  const normalizedCarrier = normalizeCarrierKey(carrier)
  const cn = encodeURIComponent(containerNumber)

  if (c.includes('maersk')) {
    return `https://www.maersk.com/tracking/${cn}`
  }
  if (c.includes('msc')) {
    return `https://www.msc.com/en/track-a-shipment`
  }
  if (c.includes('cma') || c.includes('cma-cgm')) {
    return `https://www.cma-cgm.com/ebusiness/tracking`
  }
  if (c.includes('pil')) {
    return `https://www.pilship.com/digital-solutions/?tab=customer&id=track-trace&label=containerTandT&module=TrackContStatus&refNo=${cn}`
  }
  if (ONE_CARRIER_KEYS.has(normalizedCarrier)) {
    return `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?containerNo=${cn}`
  }

  return null
}

export function carrierTrackUrl(carrier: string | null, containerNumber: string): string | null {
  const directUrl = directCarrierTrackUrl(carrier, containerNumber)
  if (directUrl !== null) {
    return directUrl
  }

  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} container ${containerNumber}`)}`
}
