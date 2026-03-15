import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'

export function toCreateProcessInput(data: CreateProcessDialogFormData): CreateProcessInput {
  const resolvedCarrier = data.carrier === 'unknown' ? null : data.carrier

  return {
    reference: data.reference || null,
    origin: data.origin ? { display_name: data.origin } : null,
    destination: data.destination ? { display_name: data.destination } : null,
    carrier: resolvedCarrier,
    bill_of_lading: data.billOfLading || null,
    booking_number: data.bookingNumber || null,
    importer_name: data.importerName || null,
    exporter_name: data.exporterName || null,
    reference_importer: data.referenceImporter || null,
    product: data.product || null,
    redestination_number: data.redestinationNumber || null,
    containers: data.containers.map((container) => ({
      container_number: container.containerNumber,
      carrier_code: resolvedCarrier,
    })),
  }
}
