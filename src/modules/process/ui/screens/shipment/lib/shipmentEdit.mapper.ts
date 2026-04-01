import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import type { ExistingProcessConflict } from '~/modules/process/ui/validation/processConflict.validation'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

type DialogCarrier = CreateProcessDialogFormData['carrier']

const DIALOG_CARRIERS: readonly DialogCarrier[] = [
  'maersk',
  'msc',
  'cmacgm',
  'pil',
  'hapag',
  'one',
  'evergreen',
  'unknown',
]

function isDialogCarrier(value: string): value is DialogCarrier {
  return DIALOG_CARRIERS.some((carrier) => carrier === value)
}

function toDialogCarrier(value: string | null | undefined): DialogCarrier {
  if (!value) return 'unknown'
  return isDialogCarrier(value) ? value : 'unknown'
}

export function toEditInitialData(data: ShipmentDetailVM): CreateProcessDialogFormData {
  return {
    reference: data.reference ?? '',
    origin: data.origin || '',
    destination: data.destination || '',
    containers: data.containers.map((container) => ({
      id: container.id,
      containerNumber: container.number,
    })),
    carrier: toDialogCarrier(data.carrier),
    billOfLading: data.bill_of_lading ?? '',
    bookingNumber: data.booking_number ?? '',
    importerName: data.importer_name ?? '',
    exporterName: data.exporter_name ?? '',
    referenceImporter: data.reference_importer ?? '',
    product: data.product ?? '',
    redestinationNumber: data.redestination_number ?? '',
  }
}

export function toCreateErrorMessage(value: string | ExistingProcessConflict | null): string {
  if (typeof value === 'string') return value
  return value?.message ?? ''
}

export function toCreateErrorExisting(
  value: string | ExistingProcessConflict | null,
): ExistingProcessConflict | undefined {
  if (typeof value === 'string') return undefined
  return value ?? undefined
}
