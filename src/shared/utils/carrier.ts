// Carrier tracking URL helpers
export function carrierTrackUrl(carrier: string | null, containerNumber: string): string | null {
  if (!carrier || !containerNumber) return null
  const c = carrier.toLowerCase()
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

  return `https://www.google.com/search?q=${encodeURIComponent(carrier + ' container ' + containerNumber)}`
}
