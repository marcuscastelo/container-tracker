import { syncControllers } from '~/shared/api/sync.controllers.bootstrap'

export const runtime = 'nodejs'

export const POST = syncControllers.detectCarrierByProcessId
