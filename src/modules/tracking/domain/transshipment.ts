import z from 'zod/v4'

/**
 * Transshipment info — derived attribute, NOT a status.
 *
 * @see docs/master-consolidated-0209.md §2.7
 */
export const TransshipmentInfoSchema = z.object({
  hasTransshipment: z.boolean(),
  transshipmentCount: z.number().int().min(0),
  /** Unique ports involved in LOAD/DISCHARGE pairs */
  ports: z.array(z.string()),
})

export type TransshipmentInfo = z.infer<typeof TransshipmentInfoSchema>
