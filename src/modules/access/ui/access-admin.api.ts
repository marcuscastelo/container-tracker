import { z } from 'zod/v4'

const AccessTenantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.string(),
})

const AccessRoleDefinitionSchema = z.object({
  id: z.string().uuid(),
  platformTenantId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
})

const AccessUserSchema = z.object({
  id: z.string().uuid(),
  workosUserId: z.string(),
  email: z.string(),
})

const AccessMembershipSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platformTenantId: z.string().uuid(),
  roleCode: z.string(),
  status: z.string(),
})

const AccessImporterSchema = z.object({
  id: z.string().uuid(),
  platformTenantId: z.string().uuid(),
  name: z.string(),
  taxId: z.string().nullable(),
  status: z.string(),
})

const AccessMembershipImporterAccessSchema = z.object({
  membershipId: z.string().uuid(),
  importerId: z.string().uuid(),
})

const AccessOverviewSchema = z.object({
  tenants: z.array(AccessTenantSchema),
  roleDefinitions: z.array(AccessRoleDefinitionSchema),
  users: z.array(AccessUserSchema),
  memberships: z.array(AccessMembershipSchema),
  importers: z.array(AccessImporterSchema),
  membershipImporterAccess: z.array(AccessMembershipImporterAccessSchema),
})

export type AccessOverviewResponse = z.infer<typeof AccessOverviewSchema>

async function parseJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}))
}

async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) return
  const payload = await parseJsonResponse(response)
  const parsed = z.object({ error: z.string().optional() }).safeParse(payload)
  if (parsed.success && parsed.data.error) {
    throw new Error(parsed.data.error)
  }
  throw new Error(`Request failed with status ${response.status}`)
}

export async function fetchAccessOverview(
  platformTenantId?: string,
): Promise<AccessOverviewResponse> {
  const params = new URLSearchParams()
  if (platformTenantId) params.set('platform_tenant_id', platformTenantId)
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : ''
  const response = await fetch(`/api/access/overview${suffix}`)
  await throwIfNotOk(response)
  return AccessOverviewSchema.parse(await parseJsonResponse(response))
}

export async function createAccessTenant(command: {
  readonly slug: string
  readonly name: string
}): Promise<void> {
  const response = await fetch('/api/access/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: command.slug,
      name: command.name,
      status: 'ACTIVE',
    }),
  })
  await throwIfNotOk(response)
}

export async function createAccessImporter(command: {
  readonly platformTenantId: string
  readonly name: string
  readonly taxId: string | null
}): Promise<void> {
  const response = await fetch('/api/access/importers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform_tenant_id: command.platformTenantId,
      name: command.name,
      tax_id: command.taxId,
      status: 'ACTIVE',
    }),
  })
  await throwIfNotOk(response)
}

export async function upsertAccessMembership(command: {
  readonly workosUserId: string
  readonly email: string
  readonly platformTenantId: string
  readonly roleCode: string
  readonly importerIds: readonly string[]
}): Promise<void> {
  const response = await fetch('/api/access/memberships', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workos_user_id: command.workosUserId,
      email: command.email,
      platform_tenant_id: command.platformTenantId,
      role_code: command.roleCode,
      status: 'ACTIVE',
      importer_ids: command.importerIds,
    }),
  })
  await throwIfNotOk(response)
}
