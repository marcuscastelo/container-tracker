import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { toProcessDialogCarrier } from '~/modules/process/ui/carrierCatalog'
import type { ExistingProcessConflict } from '~/modules/process/ui/validation/processConflict.validation'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

export function toEditInitialData(data: ShipmentDetailVM): CreateProcessDialogFormData {
  return {
    reference: data.reference ?? '',
    origin: data.origin || '',
    destination: data.destination || '',
    containers: data.containers.map((container) => ({
      id: container.id,
      containerNumber: container.number,
    })),
    carrier: toProcessDialogCarrier(data.carrier),
    billOfLading: data.bill_of_lading ?? '',
    bookingNumber: data.booking_number ?? '',
    importerName: data.importer_name ?? '',
    exporterName: data.exporter_name ?? '',
    referenceImporter: data.reference_importer ?? '',
    depositary: data.depositary ?? '',
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
