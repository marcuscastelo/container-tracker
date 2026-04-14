import { z } from 'zod/v4'

export const SyncResultKindSchema = z.enum(['accepted', 'failed', 'lease_conflict'])

export type SyncResultKind = z.infer<typeof SyncResultKindSchema>
