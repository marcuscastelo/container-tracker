export type AccessTenant = {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly status: string
  readonly createdAt: string
}

export type AccessRoleDefinition = {
  readonly id: string
  readonly platformTenantId: string
  readonly code: string
  readonly name: string
  readonly isSystem: boolean
}

export type AccessUser = {
  readonly id: string
  readonly workosUserId: string
  readonly email: string
}

export type AccessMembership = {
  readonly id: string
  readonly userId: string
  readonly platformTenantId: string
  readonly roleCode: string
  readonly status: string
}

export type AccessImporter = {
  readonly id: string
  readonly platformTenantId: string
  readonly name: string
  readonly taxId: string | null
  readonly status: string
}

export type AccessMembershipImporterAccess = {
  readonly membershipId: string
  readonly importerId: string
}

export type AccessOverview = {
  readonly tenants: readonly AccessTenant[]
  readonly roleDefinitions: readonly AccessRoleDefinition[]
  readonly users: readonly AccessUser[]
  readonly memberships: readonly AccessMembership[]
  readonly importers: readonly AccessImporter[]
  readonly membershipImporterAccess: readonly AccessMembershipImporterAccess[]
}

export type EnsureAccessUserCommand = {
  readonly workosUserId: string
  readonly email: string
}

export type CreateTenantCommand = {
  readonly slug: string
  readonly name: string
  readonly status: 'ACTIVE' | 'INACTIVE'
}

export type CreateImporterCommand = {
  readonly platformTenantId: string
  readonly name: string
  readonly taxId: string | null
  readonly status: 'ACTIVE' | 'INACTIVE'
}

export type UpsertMembershipCommand = {
  readonly userId: string
  readonly platformTenantId: string
  readonly roleCode: string
  readonly status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
}
