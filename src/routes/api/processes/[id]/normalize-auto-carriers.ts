import { processControllers } from '~/modules/process/interface/http/process.controllers.bootstrap'

export const runtime = 'nodejs'

export const POST = processControllers.normalizeAutoCarriersByProcessId
