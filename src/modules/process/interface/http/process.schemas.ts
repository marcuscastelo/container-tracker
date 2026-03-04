import z from 'zod/v4'

/**
 * Carrier Zod schema for HTTP-boundary validation.
 * This is the interface layer's own schema — domain types are plain.
 */
const CarrierSchema = z.enum(['maersk', 'msc', 'cmacgm', 'hapag', 'one', 'evergreen', 'unknown'])
const OperationalWorkflowStateSchema = z.enum([
  'WAITING_BL',
  'ARRIVAL_FORECAST',
  'DELAYED_WAITING_CUSTOMS_PRESENCE',
  'WAITING_FUNDS',
  'WAITING_ICMS',
  'LOADING',
  'INVOICING',
])
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

export const MoveProcessWorkflowInputSchema = z.object({
  targetState: OperationalWorkflowStateSchema,
})
