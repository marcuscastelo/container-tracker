import { exportImportControllers } from '~/shared/api/export-import.controllers.bootstrap'

export const runtime = 'nodejs'

export const POST = exportImportControllers.exportSymmetric
