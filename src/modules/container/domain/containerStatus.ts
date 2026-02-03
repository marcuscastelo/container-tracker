import { z } from 'zod/v4'

/**
 * Container Status entity schema.
 * Maps to the Supabase table `container-status` which has:
 * - container_id: string (primary key)
 * - status: JSONB
 */
export const containerStatusSchema = z.object({
  container_id: z.string(),
  carrier: z.string(),
  status: z.record(z.unknown()),
})

export type ContainerStatus = Readonly<z.infer<typeof containerStatusSchema>>

export const newContainerStatusSchema = containerStatusSchema

export type NewContainerStatus = ContainerStatus

export function createContainerStatus(
  containerId: string,
  status: Record<string, unknown>,
): ContainerStatus {
  return {
    container_id: containerId,
    status,
  }
}
