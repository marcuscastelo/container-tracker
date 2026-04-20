import { z } from 'zod/v4'
import type { AccessRepository } from '~/modules/access/application/access.repository'
import type {
  AccessMembership,
  AccessOverview,
  AccessTenant,
  AccessUser,
  CreateImporterCommand,
  CreateTenantCommand,
} from '~/modules/access/application/access.types'
import { type IssuedSupabaseJwt, issueSupabaseJwt } from '~/shared/auth/supabase-jwt'
import { HttpError } from '~/shared/errors/httpErrors'

const SessionExpiresInSecSchema = z.coerce.number().int().min(60).max(86400).default(3600)

export type AccessUseCases = {
  readonly listOverview: (
    platformTenantId: string | null,
    accessToken: string | null,
  ) => Promise<AccessOverview>
  readonly createTenant: (command: CreateTenantCommand) => Promise<AccessTenant>
  readonly createImporter: (command: CreateImporterCommand) => Promise<void>
  readonly upsertMembershipAndScope: (command: {
    readonly workosUserId: string
    readonly email: string
    readonly platformTenantId: string
    readonly roleCode: string
    readonly status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    readonly importerIds: readonly string[]
  }) => Promise<{ readonly user: AccessUser; readonly membership: AccessMembership }>
  readonly bridgeSession: (command: {
    readonly workosUserId: string
    readonly email: string
    readonly platformTenantId: string | null
    readonly expiresInSec: number | null
  }) => Promise<{
    readonly user: AccessUser
    readonly token: IssuedSupabaseJwt
  }>
}

export function createAccessUseCases(deps: {
  readonly repository: AccessRepository
  readonly supabaseJwtSecret: string | null
}): AccessUseCases {
  return {
    async listOverview(platformTenantId, accessToken) {
      return deps.repository.listOverview(platformTenantId, accessToken)
    },

    async createTenant(command) {
      const tenant = await deps.repository.createTenant(command)
      await deps.repository.seedSystemRolesForTenant(tenant.id)
      return tenant
    },

    async createImporter(command) {
      await deps.repository.createImporter(command)
    },

    async upsertMembershipAndScope(command) {
      const user = await deps.repository.ensureUser({
        workosUserId: command.workosUserId,
        email: command.email,
      })

      const membership = await deps.repository.upsertMembership({
        userId: user.id,
        platformTenantId: command.platformTenantId,
        roleCode: command.roleCode,
        status: command.status,
      })

      await deps.repository.replaceMembershipImporterAccess(membership.id, command.importerIds)

      return { user, membership }
    },

    async bridgeSession(command) {
      if (!deps.supabaseJwtSecret) {
        throw new HttpError('SUPABASE_JWT_SECRET is not configured', 500)
      }

      const user = await deps.repository.ensureUser({
        workosUserId: command.workosUserId,
        email: command.email,
      })

      if (command.platformTenantId) {
        const hasMembership = await deps.repository.hasActiveMembershipForTenant(
          user.id,
          command.platformTenantId,
        )
        if (!hasMembership) {
          throw new HttpError('No active membership for tenant', 403)
        }
      }

      const expiresInSec = SessionExpiresInSecSchema.parse(command.expiresInSec ?? 3600)
      const token = issueSupabaseJwt({
        userId: user.id,
        email: user.email,
        secret: deps.supabaseJwtSecret,
        issuer: 'container-tracker/access-bridge',
        expiresInSec,
      })

      return { user, token }
    },
  }
}
