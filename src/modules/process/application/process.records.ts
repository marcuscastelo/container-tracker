export type InsertProcessRecord = Readonly<{
  reference: string | null
  origin?: string | null
  destination?: string | null
  carrier_mode?: 'AUTO' | 'MANUAL'
  default_carrier_code?: string | null
  last_resolved_carrier_code?: string | null
  carrier_resolved_at?: string | null
  // Legacy compatibility field; mirrors default_carrier_code while API contracts migrate.
  carrier: string | null
  bill_of_lading: string | null
  booking_number: string | null
  importer_name: string | null
  exporter_name: string | null
  reference_importer: string | null
  product?: string | null
  redestination_number?: string | null
  source: string
}>

export type UpdateProcessRecord = Readonly<{
  reference?: string | null
  origin?: string | null
  destination?: string | null
  carrier_mode?: 'AUTO' | 'MANUAL'
  default_carrier_code?: string | null
  last_resolved_carrier_code?: string | null
  carrier_resolved_at?: string | null
  // Legacy compatibility field; mirrors default_carrier_code while API contracts migrate.
  carrier?: string | null
  bill_of_lading?: string | null
  booking_number?: string | null
  importer_name?: string | null
  exporter_name?: string | null
  reference_importer?: string | null
  product?: string | null
  redestination_number?: string | null
  source?: string
}>
