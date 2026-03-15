import { createExportImportUseCases } from '~/capabilities/export-import/application/export-import.usecases'
import { createExportImportControllers } from '~/capabilities/export-import/interface/http/export-import.controllers'
import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'

export function bootstrapExportImportControllers(deps: {
  readonly processUseCases: Pick<
    ProcessUseCases,
    | 'listProcesses'
    | 'listProcessesWithContainers'
    | 'findProcessByIdWithContainers'
    | 'listProcessesWithOperationalSummary'
    | 'createProcess'
    | 'deleteProcess'
  >
  readonly trackingUseCases: Pick<TrackingUseCases, 'getContainerSummary'>
}) {
  const exportImportUseCases = createExportImportUseCases({
    processUseCases: deps.processUseCases,
    trackingUseCases: deps.trackingUseCases,
  })

  const exportImportControllers = createExportImportControllers({
    exportImportUseCases,
  })

  return {
    exportImportUseCases,
    exportImportControllers,
  }
}
