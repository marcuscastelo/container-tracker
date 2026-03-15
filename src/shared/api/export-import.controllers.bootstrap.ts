import { bootstrapExportImportControllers } from '~/capabilities/export-import/interface/http/export-import.controllers.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

const { trackingUseCases } = bootstrapTrackingModule()

const bootstrapped = bootstrapExportImportControllers({
  processUseCases,
  trackingUseCases,
})

export const exportImportControllers = bootstrapped.exportImportControllers
