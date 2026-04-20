import { z } from 'zod/v4'

export const AccessOverviewQuerySchema = z.object({
  platform_tenant_id: z.string().uuid().optional(),
})

export const CreateTenantBodySchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/u),
  name: z.string().min(2).max(120),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const CreateImporterBodySchema = z.object({
  platform_tenant_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  tax_id: z.string().min(1).max(64).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const UpsertMembershipBodySchema = z.object({
  workos_user_id: z.string().min(1),
  email: z.string().email(),
  platform_tenant_id: z.string().uuid(),
  role_code: z.string().min(2).max(64),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  importer_ids: z.array(z.string().uuid()).default([]),
})
