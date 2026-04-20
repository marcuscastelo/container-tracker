const CARRIER_DISPLAY_BY_KEY: Readonly<Record<string, string>> = {
  maersk: 'Maersk',
  maerskline: 'Maersk',
  msc: 'MSC',
  mediterraneanshippingcompany: 'MSC',
  cmacgm: 'CMA CGM',
  cmacgmlines: 'CMA CGM',
  pil: 'PIL',
  pacificinternationallines: 'PIL',
  one: 'ONE',
  oneline: 'ONE',
  oceannetworkexpress: 'ONE',
  hapag: 'Hapag-Lloyd',
  hapaglloyd: 'Hapag-Lloyd',
  evergreen: 'Evergreen',
  evergreenline: 'Evergreen',
  unknown: 'UNKNOWN',
}

export function normalizeCarrierKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function toCarrierDisplayLabel(value: string | null | undefined): string | null {
  if (value == null) return null

  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  const normalized = normalizeCarrierKey(trimmed)
  if (normalized.length === 0) return null

  return CARRIER_DISPLAY_BY_KEY[normalized] ?? trimmed
}
