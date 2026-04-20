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

export type AccessRepository = {
  readonly listOverview: (platformTenantId: string | null) => Promise<AccessOverview>
  readonly createTenant: (command: CreateTenantCommand) => Promise<AccessTenant>
  readonly seedSystemRolesForTenant: (
    platformTenantId: string,
  ) => Promise<readonly AccessRoleDefinition[]>
  readonly createImporter: (command: CreateImporterCommand) => Promise<AccessImporter>
  readonly ensureUser: (command: EnsureAccessUserCommand) => Promise<AccessUser>
  readonly upsertMembership: (command: UpsertMembershipCommand) => Promise<AccessMembership>
  readonly replaceMembershipImporterAccess: (
    membershipId: string,
    importerIds: readonly string[],
  ) => Promise<readonly AccessMembershipImporterAccess[]>
}
