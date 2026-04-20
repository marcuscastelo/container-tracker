import { createClient } from '@supabase/supabase-js'
import { z } from 'zod/v4'
import type { AccessRepository } from '~/modules/access/application/access.repository'
import type {
  AccessImporter,
  AccessMembership,
  AccessMembershipImporterAccess,
  AccessOverview,
  AccessRoleDefinition,
  AccessTenant,
  AccessUser,
  CreateImporterCommand,
  CreateTenantCommand,
  EnsureAccessUserCommand,
  UpsertMembershipCommand,
} from '~/modules/access/application/access.types'
import { serverEnv } from '~/shared/config/server-env'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TenantRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  created_at: z.string(),
})

const RoleDefinitionRowSchema = z.object({
  id: z.string().uuid(),
  platform_tenant_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  is_system: z.boolean(),
})

const UserRowSchema = z.object({
  id: z.string().uuid(),
  workos_user_id: z.string(),
  email: z.string(),
})

const MembershipRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  platform_tenant_id: z.string().uuid(),
  role_code: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
})

const ImporterRowSchema = z.object({
  id: z.string().uuid(),
  platform_tenant_id: z.string().uuid(),
  name: z.string(),
  tax_id: z.string().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

const MembershipImporterAccessRowSchema = z.object({
  membership_id: z.string().uuid(),
  importer_id: z.string().uuid(),
})

const TenantRowsSchema = z.array(TenantRowSchema)
const RoleDefinitionRowsSchema = z.array(RoleDefinitionRowSchema)
const UserRowsSchema = z.array(UserRowSchema)
const MembershipRowsSchema = z.array(MembershipRowSchema)
const ImporterRowsSchema = z.array(ImporterRowSchema)
const MembershipImporterAccessRowsSchema = z.array(MembershipImporterAccessRowSchema)
const MembershipIdRowsSchema = z.array(z.object({ id: z.string().uuid() }))
const MembershipUserIdRowsSchema = z.array(z.object({ user_id: z.string().uuid() }))

const accessSupabase = createClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

function toTenant(row: z.infer<typeof TenantRowSchema>): AccessTenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
  }
}

function toRoleDefinition(row: z.infer<typeof RoleDefinitionRowSchema>): AccessRoleDefinition {
  return {
    id: row.id,
    platformTenantId: row.platform_tenant_id,
    code: row.code,
    name: row.name,
    isSystem: row.is_system,
  }
}

function toUser(row: z.infer<typeof UserRowSchema>): AccessUser {
  return {
    id: row.id,
    workosUserId: row.workos_user_id,
    email: row.email,
  }
}

function toMembership(row: z.infer<typeof MembershipRowSchema>): AccessMembership {
  return {
    id: row.id,
    userId: row.user_id,
    platformTenantId: row.platform_tenant_id,
    roleCode: row.role_code,
    status: row.status,
  }
}

function toImporter(row: z.infer<typeof ImporterRowSchema>): AccessImporter {
  return {
    id: row.id,
    platformTenantId: row.platform_tenant_id,
    name: row.name,
    taxId: row.tax_id,
    status: row.status,
  }
}

function toMembershipImporterAccess(
  row: z.infer<typeof MembershipImporterAccessRowSchema>,
): AccessMembershipImporterAccess {
  return {
    membershipId: row.membership_id,
    importerId: row.importer_id,
  }
}

async function listTenants(platformTenantId: string | null): Promise<readonly AccessTenant[]> {
  let query = accessSupabase
    .from('platform_tenants')
    .select('id,slug,name,status,created_at')
    .order('created_at', { ascending: true })
  if (platformTenantId) {
    query = query.eq('id', platformTenantId)
  }

  const result = await query
  const data = unwrapSupabaseResultOrThrow(result, {
    operation: 'listTenants',
    table: 'platform_tenants',
  })

  return TenantRowsSchema.parse(data).map(toTenant)
}

async function listRoleDefinitions(
  platformTenantId: string | null,
): Promise<readonly AccessRoleDefinition[]> {
  let query = accessSupabase
    .from('tenant_role_definitions')
    .select('id,platform_tenant_id,code,name,is_system')
    .order('platform_tenant_id', { ascending: true })
    .order('code', { ascending: true })
  if (platformTenantId) {
    query = query.eq('platform_tenant_id', platformTenantId)
  }

  const result = await query
  const data = unwrapSupabaseResultOrThrow(result, {
    operation: 'listRoleDefinitions',
    table: 'tenant_role_definitions',
  })

  return RoleDefinitionRowsSchema.parse(data).map(toRoleDefinition)
}

async function listUsers(platformTenantId: string | null): Promise<readonly AccessUser[]> {
  if (platformTenantId === null) {
    const result = await accessSupabase
      .from('users')
      .select('id,workos_user_id,email')
      .order('created_at', { ascending: true })
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'listUsers',
      table: 'users',
    })
    return UserRowsSchema.parse(data).map(toUser)
  }

  const membershipResult = await accessSupabase
    .from('tenant_memberships')
    .select('user_id')
    .eq('platform_tenant_id', platformTenantId)
  const membershipData = unwrapSupabaseResultOrThrow(membershipResult, {
    operation: 'listUsers.memberships',
    table: 'tenant_memberships',
  })
  const userIds = [
    ...new Set(MembershipUserIdRowsSchema.parse(membershipData).map((row) => row.user_id)),
  ]
  if (userIds.length === 0) {
    return []
  }

  const result = await accessSupabase
    .from('users')
    .select('id,workos_user_id,email')
    .in('id', userIds)
    .order('created_at', { ascending: true })
  const data = unwrapSupabaseResultOrThrow(result, {
    operation: 'listUsers',
    table: 'users',
  })
  return UserRowsSchema.parse(data).map(toUser)
}

async function listMemberships(
  platformTenantId: string | null,
): Promise<readonly AccessMembership[]> {
  let query = accessSupabase
    .from('tenant_memberships')
    .select('id,user_id,platform_tenant_id,role_code,status')
    .order('created_at', { ascending: true })
  if (platformTenantId) {
    query = query.eq('platform_tenant_id', platformTenantId)
  }
  const result = await query
  const data = unwrapSupabaseResultOrThrow(result, {
    operation: 'listMemberships',
    table: 'tenant_memberships',
  })
  return MembershipRowsSchema.parse(data).map(toMembership)
}

async function listImporters(platformTenantId: string | null): Promise<readonly AccessImporter[]> {
  let query = accessSupabase
    .from('importers')
    .select('id,platform_tenant_id,name,tax_id,status')
    .order('created_at', { ascending: true })
  if (platformTenantId) {
    query = query.eq('platform_tenant_id', platformTenantId)
  }
  const result = await query
  const data = unwrapSupabaseResultOrThrow(result, {
    operation: 'listImporters',
    table: 'importers',
  })
  return ImporterRowsSchema.parse(data).map(toImporter)
}

async function listMembershipImporterAccess(
  platformTenantId: string | null,
): Promise<readonly AccessMembershipImporterAccess[]> {
  let query = accessSupabase
    .from('membership_importer_access')
    .select('membership_id,importer_id')
    .order('membership_id', { ascending: true })
  if (platformTenantId) {
    const membershipIdsResult = await accessSupabase
      .from('tenant_memberships')
      .select('id')
      .eq('platform_tenant_id', platformTenantId)
    const membershipIdsData = unwrapSupabaseResultOrThrow(membershipIdsResult, {
      operation: 'listMembershipImporterAccess.memberships',
      table: 'tenant_memberships',
    })
    const membershipIds = MembershipIdRowsSchema.parse(membershipIdsData).map((row) => row.id)
    if (membershipIds.length === 0) return []

    query = query.in('membership_id', membershipIds)
  }
  const result = await query
  const data = unwrapSupabaseResultOrThrow(result, {
    operation: 'listMembershipImporterAccess',
    table: 'membership_importer_access',
  })
  return MembershipImporterAccessRowsSchema.parse(data).map(toMembershipImporterAccess)
}

export const supabaseAccessRepository: AccessRepository = {
  async listOverview(platformTenantId, _accessToken): Promise<AccessOverview> {
    const [tenants, roleDefinitions, users, memberships, importers, membershipImporterAccess] =
      await Promise.all([
        listTenants(platformTenantId),
        listRoleDefinitions(platformTenantId),
        listUsers(platformTenantId),
        listMemberships(platformTenantId),
        listImporters(platformTenantId),
        listMembershipImporterAccess(platformTenantId),
      ])

    return {
      tenants,
      roleDefinitions,
      users,
      memberships,
      importers,
      membershipImporterAccess,
    }
  },

  async createTenant(command: CreateTenantCommand): Promise<AccessTenant> {
    const result = await accessSupabase
      .from('platform_tenants')
      .insert({
        slug: command.slug,
        name: command.name,
        status: command.status,
      })
      .select('id,slug,name,status,created_at')
      .single()

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'createTenant',
      table: 'platform_tenants',
    })
    return toTenant(TenantRowSchema.parse(data))
  },

  async seedSystemRolesForTenant(platformTenantId) {
    const rows = [
      { platform_tenant_id: platformTenantId, code: 'ADMIN', name: 'Admin', is_system: true },
      { platform_tenant_id: platformTenantId, code: 'IMPORTER', name: 'Importer', is_system: true },
    ]
    const result = await accessSupabase
      .from('tenant_role_definitions')
      .upsert(rows, { onConflict: 'platform_tenant_id,code' })
      .select('id,platform_tenant_id,code,name,is_system')

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'seedSystemRolesForTenant',
      table: 'tenant_role_definitions',
    })
    return RoleDefinitionRowsSchema.parse(data).map(toRoleDefinition)
  },

  async createImporter(command: CreateImporterCommand): Promise<AccessImporter> {
    const result = await accessSupabase
      .from('importers')
      .insert({
        platform_tenant_id: command.platformTenantId,
        name: command.name,
        tax_id: command.taxId,
        status: command.status,
      })
      .select('id,platform_tenant_id,name,tax_id,status')
      .single()

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'createImporter',
      table: 'importers',
    })
    return toImporter(ImporterRowSchema.parse(data))
  },

  async ensureUser(command: EnsureAccessUserCommand): Promise<AccessUser> {
    const result = await accessSupabase
      .from('users')
      .upsert(
        {
          workos_user_id: command.workosUserId,
          email: command.email,
        },
        { onConflict: 'workos_user_id' },
      )
      .select('id,workos_user_id,email')
      .single()
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'ensureUser.upsert',
      table: 'users',
    })
    return toUser(UserRowSchema.parse(data))
  },

  async upsertMembership(command: UpsertMembershipCommand): Promise<AccessMembership> {
    const result = await accessSupabase
      .from('tenant_memberships')
      .upsert(
        {
          user_id: command.userId,
          platform_tenant_id: command.platformTenantId,
          role_code: command.roleCode,
          status: command.status,
        },
        { onConflict: 'user_id,platform_tenant_id' },
      )
      .select('id,user_id,platform_tenant_id,role_code,status')
      .single()

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'upsertMembership',
      table: 'tenant_memberships',
    })
    return toMembership(MembershipRowSchema.parse(data))
  },

  async replaceMembershipImporterAccess(membershipId, importerIds) {
    const deleteResult = await accessSupabase
      .from('membership_importer_access')
      .delete()
      .eq('membership_id', membershipId)
    unwrapSupabaseResultOrThrow(deleteResult, {
      operation: 'replaceMembershipImporterAccess.delete',
      table: 'membership_importer_access',
    })

    if (importerIds.length === 0) return []

    const rows = importerIds.map((importerId) => ({
      membership_id: membershipId,
      importer_id: importerId,
    }))
    const insertResult = await accessSupabase
      .from('membership_importer_access')
      .insert(rows)
      .select('membership_id,importer_id')
    const data = unwrapSupabaseResultOrThrow(insertResult, {
      operation: 'replaceMembershipImporterAccess.insert',
      table: 'membership_importer_access',
    })
    return MembershipImporterAccessRowsSchema.parse(data).map(toMembershipImporterAccess)
  },

  async hasActiveMembershipForTenant(userId, platformTenantId): Promise<boolean> {
    const result = await accessSupabase
      .from('tenant_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('platform_tenant_id', platformTenantId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle()
    const data = unwrapSupabaseSingleOrNull(result, {
      operation: 'hasActiveMembershipForTenant',
      table: 'tenant_memberships',
    })
    return data !== null
  },
}
