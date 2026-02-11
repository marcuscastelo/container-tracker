export type InsertProcessRecord = Readonly<{
  reference: string
  origin?: string | null
  destination?: string | null
  carrier: string
  bill_of_lading: string
  booking_number: string
  importer_name: string
  exporter_name: string
  reference_importer: string
  product?: string | null
  redestination_number?: string | null
  source: string
}>

export type UpdateProcessRecord = Readonly<{
  reference?: string
  origin?: string | null
  destination?: string | null
  carrier?: string
  bill_of_lading?: string
  booking_number?: string
  importer_name?: string
  exporter_name?: string
  reference_importer?: string
  product?: string | null
  redestination_number?: string | null
  source?: string
}>
