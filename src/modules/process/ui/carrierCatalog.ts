export const PROCESS_DIALOG_CARRIER_VALUES = [
  'maersk',
  'msc',
  'cmacgm',
  'pil',
  'one',
  'hapag',
  'evergreen',
  'unknown',
] as const

export type ProcessDialogCarrier = (typeof PROCESS_DIALOG_CARRIER_VALUES)[number]

const PROCESS_DIALOG_CARRIER_BY_KEY: Readonly<Record<string, ProcessDialogCarrier>> = {
  maersk: 'maersk',
  maerskline: 'maersk',
  msc: 'msc',
  mediterraneanshippingcompany: 'msc',
  cmacgm: 'cmacgm',
  cmacgmlines: 'cmacgm',
  pil: 'pil',
  pacificinternationallines: 'pil',
  one: 'one',
  oneline: 'one',
  oceannetworkexpress: 'one',
  hapag: 'hapag',
  hapaglloyd: 'hapag',
  evergreen: 'evergreen',
  evergreenline: 'evergreen',
  unknown: 'unknown',
} as const

const PROCESS_DIALOG_CARRIER_LABELS: Readonly<
  Record<Exclude<ProcessDialogCarrier, 'unknown'>, string>
> = {
  maersk: 'Maersk',
  msc: 'MSC',
  cmacgm: 'CMA CGM',
  pil: 'PIL',
  one: 'ONE',
  hapag: 'Hapag-Lloyd',
  evergreen: 'Evergreen',
} as const

function normalizeCarrierKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function isProcessDialogCarrier(value: string): value is ProcessDialogCarrier {
  return PROCESS_DIALOG_CARRIER_VALUES.some((carrier) => carrier === value)
}

export function toProcessDialogCarrier(value: string | null | undefined): ProcessDialogCarrier {
  if (!value) return 'unknown'

  const normalized = normalizeCarrierKey(value)
  if (normalized.length === 0) return 'unknown'

  return PROCESS_DIALOG_CARRIER_BY_KEY[normalized] ?? 'unknown'
}

export function buildProcessCarrierOptions(
  unknownLabel: string,
): readonly { readonly value: ProcessDialogCarrier; readonly label: string }[] {
  return [
    { value: 'maersk', label: PROCESS_DIALOG_CARRIER_LABELS.maersk },
    { value: 'msc', label: PROCESS_DIALOG_CARRIER_LABELS.msc },
    { value: 'cmacgm', label: PROCESS_DIALOG_CARRIER_LABELS.cmacgm },
    { value: 'pil', label: PROCESS_DIALOG_CARRIER_LABELS.pil },
    { value: 'one', label: PROCESS_DIALOG_CARRIER_LABELS.one },
    { value: 'hapag', label: PROCESS_DIALOG_CARRIER_LABELS.hapag },
    { value: 'evergreen', label: PROCESS_DIALOG_CARRIER_LABELS.evergreen },
    { value: 'unknown', label: unknownLabel },
  ]
}
