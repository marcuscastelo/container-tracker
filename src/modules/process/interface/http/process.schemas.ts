import z from 'zod/v4'

import { CarrierSchema } from '~/modules/process/domain/value-objects'
/**
 * Schema for creating a new process (input from UI)
 */
export const CreateProcessInputSchema = z.object({
  reference: z.string().nullable().optional(),
  origin: z
    .object({
      display_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  destination: z
    .object({
      display_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  carrier: CarrierSchema,
  bill_of_lading: z.string().nullable().optional(),
  booking_number: z.string().nullable().optional(),
  importer_name: z.string().nullable().optional(),
  exporter_name: z.string().nullable().optional(),
  reference_importer: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  redestination_number: z.string().nullable().optional(),
  containers: z
    .array(
      z.object({
        container_number: z.string().min(1),
        carrier_code: z.string(),
      }),
    )
    .min(1, 'At least one container is required'),
})
export type CreateProcessInput = z.infer<typeof CreateProcessInputSchema>

/**
 * Schema for the check-containers endpoint (POST /api/processes/check).
 */
export const CheckContainersBodySchema = z.object({
  containers: z.array(z.string()).nonempty(),
})
