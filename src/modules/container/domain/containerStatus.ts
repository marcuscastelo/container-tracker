import { z } from 'zod'

/**
 * Container Status entity schema.
 * Lightweight canonical status object used across the app. Persisted as
 * `container_tracking_snapshots.raw_payload` in Supabase (append-only).
 */
export const containerStatusSchema = z.object({
  container_id: z.string(),
  carrier: z.string(),
  status: z.record(z.string(), z.unknown()),
})

export type ContainerStatus = Readonly<z.infer<typeof containerStatusSchema>>

export const newContainerStatusSchema = containerStatusSchema

export type NewContainerStatus = ContainerStatus

export function createContainerStatus(
  containerId: string,
  status: Record<string, unknown>,
  carrier = 'UNKNOWN',
): ContainerStatus {
  return {
    container_id: containerId,
    carrier,
    status,
  }
}
