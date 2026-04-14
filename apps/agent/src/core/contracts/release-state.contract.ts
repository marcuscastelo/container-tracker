import { z } from 'zod/v4'

export const RawReleaseStateFileSchema = z.record(z.string(), z.unknown())

export type RawReleaseStateFile = z.infer<typeof RawReleaseStateFileSchema>

export const ActivationStateSchema = z.enum([
  'idle',
  'pending',
  'verifying',
  'rolled_back',
  'blocked',
])

export const ReleaseFailureEntrySchema = z.object({
  version: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true }),
})

export const ActivationFailuresSchema = z
  .record(z.string().min(1), z.number().int().min(0))
  .default({})

export const ReleaseStateSchema = z.object({
  current_version: z.string().min(1),
  previous_version: z.string().min(1).nullable(),
  last_known_good_version: z.string().min(1),
  target_version: z.string().min(1).nullable(),
  activation_state: ActivationStateSchema,
  failure_count: z.number().int().min(0),
  last_update_attempt: z.string().datetime({ offset: true }).nullable(),
  blocked_versions: z.array(z.string().min(1)).default([]),
  automatic_updates_blocked: z.boolean().default(false),
  recent_failures: z.array(ReleaseFailureEntrySchema).default([]),
  activation_failures: ActivationFailuresSchema,
  last_error: z.string().nullable().default(null),
})

export type ReleaseFailureEntry = z.infer<typeof ReleaseFailureEntrySchema>
export type ReleaseState = z.infer<typeof ReleaseStateSchema>
