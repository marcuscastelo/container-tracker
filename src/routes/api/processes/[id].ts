import { processControllers } from '~/modules/process/interface/http/process.controllers.bootstrap'

export const GET = processControllers.getProcessById
export const PATCH = processControllers.updateProcessById
export const DELETE = processControllers.deleteProcessById
