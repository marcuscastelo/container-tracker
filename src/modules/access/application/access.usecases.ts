import type { AccessRepository } from '~/modules/access/application/access.repository'
import type {
  AccessMembership,
  AccessOverview,
  AccessTenant,
  AccessUser,
  CreateImporterCommand,
  CreateTenantCommand,
} from '~/modules/access/application/access.types'

export type AccessUseCases = {
  readonly listOverview: (platformTenantId: string | null) => Promise<AccessOverview>
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
}

export function createAccessUseCases(deps: {
  readonly repository: AccessRepository
}): AccessUseCases {
  return {
    async listOverview(platformTenantId) {
      return deps.repository.listOverview(platformTenantId)
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
        workosUserId: user.workosUserId,
        platformTenantId: command.platformTenantId,
        roleCode: command.roleCode,
        status: command.status,
      })

      await deps.repository.replaceMembershipImporterAccess(membership.id, command.importerIds)

      return { user, membership }
    },
  }
}
