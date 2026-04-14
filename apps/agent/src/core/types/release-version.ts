import { z } from 'zod/v4'

export const ReleaseVersionSchema = z.string().trim().min(1)

export type ReleaseVersion = z.infer<typeof ReleaseVersionSchema>
