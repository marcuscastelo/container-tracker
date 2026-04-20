import { accessControllers } from '~/modules/access/interface/http/access.controllers.bootstrap'

export const runtime = 'nodejs'
export const POST = accessControllers.upsertMembership
