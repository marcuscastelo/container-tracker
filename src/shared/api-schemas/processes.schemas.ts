import { z } from 'zod'

export const ProcessResponseSchema = z.object({
  id: z.string(),
  reference: z.string().nullish(),
  operation_type: z.string(),
  origin: z.object({ display_name: z.string().nullish() }).nullable().optional(),
  destination: z.object({ display_name: z.string().nullish() }).nullable().optional(),
  carrier: z.string().nullish(),
  bill_of_lading: z.string().nullish(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  containers: z.array(
    z.object({
      id: z.string(),
      container_number: z.string(),
      carrier_code: z.string().nullish(),
      container_type: z.string().nullish(),
      container_size: z.string().nullish(),
    }),
  ),
})

export const ProcessListResponseSchema = z.array(ProcessResponseSchema)

export const ErrorResponseSchema = z.object({ error: z.string() })

export const ProcessDetailResponseSchema = ProcessResponseSchema.extend({
  // The detailed view includes richer container info and alerts
  bl_reference: z.string().nullish().optional(),
  containers: z.array(
    z.object({
      id: z.string(),
      container_number: z.string(),
      carrier_code: z.string().nullish(),
      container_type: z.string().nullish(),
      container_size: z.string().nullish(),
      eta: z.string().nullish().optional(),
      events: z
        .array(
          z.object({
            id: z.string().optional(),
            activity: z.string().optional(),
            event_time: z.string().nullable().optional(),
            event_time_type: z.string().nullable().optional(),
            location: z.string().nullable().optional(),
            raw: z.unknown().optional(),
          }),
        )
        .optional(),
    }),
  ),
  alerts: z
    .array(
      z.object({
        id: z.string(),
        category: z.string(),
        code: z.string(),
        severity: z.string(),
        title: z.string(),
        description: z.string().nullable().optional(),
        state: z.string(),
        created_at: z.string(),
      }),
    )
    .optional(),
})

export const CreateProcessResponseSchema = z.object({
  process: ProcessResponseSchema,
  warnings: z.array(z.string()).readonly(),
})

export type ProcessResponse = z.infer<typeof ProcessResponseSchema>
export type ProcessListResponse = z.infer<typeof ProcessListResponseSchema>
export type CreateProcessResponse = z.infer<typeof CreateProcessResponseSchema>
export type ProcessDetailResponse = z.infer<typeof ProcessDetailResponseSchema>
