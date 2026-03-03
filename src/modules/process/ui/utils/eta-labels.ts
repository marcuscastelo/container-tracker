import type {
  ContainerEtaChipVM,
  ContainerEtaDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'

type SelectedEtaTitleLabels = {
  readonly arrived: string
  readonly expectedPrefix: string
  readonly noEta: string
}

type SelectedEtaSubtitleLabels = {
  readonly actual: string
  readonly expected: string
  readonly delayed: string
}

type EtaChipLabels = {
  readonly arrived: string
  readonly expectedPrefix: string
  readonly delayed: string
  readonly missing: string
}

export function toSelectedEtaTitle(
  selectedEta: ContainerEtaDetailVM,
  labels: SelectedEtaTitleLabels,
): string {
  if (!selectedEta) return labels.noEta
  if (selectedEta.state === 'ACTUAL') {
    return `${labels.arrived} ${selectedEta.date}`
  }
  return `${labels.expectedPrefix} ${selectedEta.date}`
}

export function toSelectedEtaSubtitle(
  selectedEta: ContainerEtaDetailVM,
  labels: SelectedEtaSubtitleLabels,
): string | null {
  if (!selectedEta) return null
  if (selectedEta.state === 'ACTUAL') return labels.actual
  if (selectedEta.state === 'EXPIRED_EXPECTED') return labels.delayed
  return labels.expected
}

export function toContainerEtaChipLabel(
  etaChip: ContainerEtaChipVM,
  labels: EtaChipLabels,
): string {
  if (etaChip.state === 'UNAVAILABLE') {
    return labels.missing
  }

  const datePart = etaChip.date ? ` ${etaChip.date}` : ''

  if (etaChip.state === 'ACTUAL') {
    return `${labels.arrived}${datePart}`
  }

  if (etaChip.state === 'EXPIRED_EXPECTED') {
    return `${labels.expectedPrefix}${datePart} · ${labels.delayed}`
  }

  return `${labels.expectedPrefix}${datePart}`
}
