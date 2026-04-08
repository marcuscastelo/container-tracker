export type InsertProcessRecord = Readonly<{
  reference: string | null
  origin?: string | null
  destination?: string | null
  carrier: string
  bill_of_lading: string | null
  booking_number: string | null
  importer_name: string | null
  exporter_name: string | null
  reference_importer: string | null
  depositary?: string | null
  product?: string | null
  redestination_number?: string | null
  source: string
}>

export type UpdateProcessRecord = Readonly<{
  reference?: string | null
  origin?: string | null
  destination?: string | null
  carrier?: string
  bill_of_lading?: string | null
  booking_number?: string | null
  importer_name?: string | null
  exporter_name?: string | null
  reference_importer?: string | null
  depositary?: string | null
  product?: string | null
  redestination_number?: string | null
  source?: string
}>
