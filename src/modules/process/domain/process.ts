import z from 'zod/v4'
import {
  Carrier,
  OperationType,
  PlannedLocation,
  ProcessSource,
} from '~/modules/process/domain/value-objects'

export const ProcessSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().nullable().optional(),
  operation_type: OperationType.default('unknown'),
  origin: PlannedLocation.nullable().optional(),
  destination: PlannedLocation.nullable().optional(),
  carrier: Carrier.nullable().optional(),
  bill_of_lading: z.string().nullable().optional(),
  booking_reference: z.string().nullable().optional(),
  source: ProcessSource.default('manual'),
  created_at: z.date(),
  updated_at: z.date(),
})

export type Process = z.infer<typeof ProcessSchema>
