import { z } from 'zod/v4'

import { ControlStateSnapshotSchema } from './control.state.ts'

export const ControlCommandExecutionStatusSchema = z.enum([
  'accepted',
  'completed',
  'failed',
])

export const ControlCommandResultSchema = z.object({
  commandId: z.string().uuid(),
  status: ControlCommandExecutionStatusSchema,
  executedAt: z.string().datetime({ offset: true }),
  message: z.string().min(1),
  snapshot: ControlStateSnapshotSchema,
})

export type ControlCommandExecutionStatus = z.infer<typeof ControlCommandExecutionStatusSchema>
export type ControlCommandResult = z.infer<typeof ControlCommandResultSchema>
