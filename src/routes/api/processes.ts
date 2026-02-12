import { processControllers } from '~/modules/process/interface/http/process.controllers.bootstrap'

export const GET = processControllers.listProcesses
export const POST = processControllers.createProcess
