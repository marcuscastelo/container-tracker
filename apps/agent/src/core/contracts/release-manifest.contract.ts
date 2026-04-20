import { z } from 'zod/v4'

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/iu

export const ReleaseManifestAssetSchema = z
  .object({
    url: z.string().url(),
    checksum: z.string().regex(CHECKSUM_PATTERN),
  })
  .strict()

export type ReleaseManifestAsset = z.infer<typeof ReleaseManifestAssetSchema>

export const UnifiedReleaseManifestSchema = z
  .object({
    channel: z.string().trim().min(1),
    version: z.string().trim().min(1),
    published_at: z.string().datetime({ offset: true }).nullable().optional(),
    platforms: z.record(z.string().min(1), ReleaseManifestAssetSchema),
  })
  .strict()

export type UnifiedReleaseManifest = z.infer<typeof UnifiedReleaseManifestSchema>

export const UpdateManifestResponseDTOSchema = z
  .object({
    version: z.string().min(1),
    channel: z.string().min(1),
    published_at: z.string().datetime({ offset: true }).nullable().optional(),
    platforms: z.record(z.string().min(1), ReleaseManifestAssetSchema),
    update_available: z.boolean(),
    desired_version: z.string().min(1).nullable(),
    current_version: z.string().min(1),
    update_ready_version: z.string().min(1).nullable(),
    restart_required: z.boolean(),
    restart_requested_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()

export type UpdateManifestResponseDTO = z.infer<typeof UpdateManifestResponseDTOSchema>
