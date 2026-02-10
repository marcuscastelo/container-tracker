import z from 'zod/v4'
import {
  CarrierSchema,
  PlannedLocation,
  ProcessSourceSchema,
} from '~/modules/process/domain/value-objects'

export const ProcessSchema = z.object({
  id: z.uuid(),
  reference: z.string().nullable().optional(),
  origin: PlannedLocation.nullable().optional(),
  destination: PlannedLocation.nullable().optional(),
  carrier: CarrierSchema.nullable().optional(),
  bill_of_lading: z.string().nullable().optional(),
  booking_number: z.string().nullable().optional(),
  importer_name: z.string().nullable().optional(),
  exporter_name: z.string().nullable().optional(),
  reference_importer: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  redestination_number: z.string().nullable().optional(),
  source: ProcessSourceSchema.default('manual'),
  created_at: z.date(),
  updated_at: z.date(),
})

export const NewProcessSchema = ProcessSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export type Process = z.infer<typeof ProcessSchema>
export type NewProcess = z.infer<typeof NewProcessSchema>
