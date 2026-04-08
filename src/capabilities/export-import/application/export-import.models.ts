import type { TemporalValueDto } from '~/shared/time/dto'

export type SymmetricExportType = 'PORTABLE_SYMMETRIC'

export type SymmetricBundleSchemaVersion = '1.0'

export type SymmetricDocumentEntry = {
  readonly importKey: string
  readonly processImportKey: string
  readonly containerImportKey: string | null
  readonly originalName: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly checksum: string | null
  readonly storageKey: string
}

export type SymmetricContainerEntry = {
  readonly importKey: string
  readonly processImportKey: string
  readonly containerNumber: string
  readonly carrierCode: string | null
}

export type SymmetricProcessEntry = {
  readonly importKey: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly depositary: string | null
  readonly carrier: string | null
  readonly billOfLading: string | null
  readonly bookingNumber: string | null
  readonly importerName: string | null
  readonly exporterName: string | null
  readonly referenceImporter: string | null
  readonly product: string | null
  readonly redestinationNumber: string | null
  readonly source: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly containers: readonly SymmetricContainerEntry[]
}

export type SymmetricBundleManifest = {
  readonly schemaVersion: SymmetricBundleSchemaVersion
  readonly exportType: SymmetricExportType
  readonly exportedAt: string
  readonly processCount: number
  readonly containerCount: number
  readonly documentCount: number
}

export type SymmetricExportBundle = {
  readonly schemaVersion: SymmetricBundleSchemaVersion
  readonly exportType: SymmetricExportType
  readonly exportedAt: string
  readonly metadata: {
    readonly tenant: string | null
    readonly processCount: number
    readonly containerCount: number
    readonly documentCount: number
  }
  readonly manifest: SymmetricBundleManifest
  readonly processes: readonly SymmetricProcessEntry[]
  readonly documents: readonly SymmetricDocumentEntry[]
}

export type SymmetricImportValidationResult = {
  readonly canImport: boolean
  readonly schemaVersion: string | null
  readonly processCount: number
  readonly containerCount: number
  readonly documentCount: number
  readonly databaseEmpty: boolean
  readonly errors: string[]
  readonly warnings: string[]
}

export type SymmetricImportExecutionResult = {
  readonly importedProcesses: number
  readonly importedContainers: number
  readonly importedDocuments: number
}

export type ReportFormat = 'json' | 'csv' | 'xlsx' | 'markdown' | 'pdf' | 'trello'

export type ReportAlertEntry = {
  readonly id: string
  readonly category: 'fact' | 'monitoring'
  readonly type: string
  readonly severity: 'info' | 'warning' | 'danger'
  readonly messageKey: string
  readonly triggeredAt: string
  readonly retroactive: boolean
}

export type ReportTimelineEntry = {
  readonly type: string
  readonly eventTime: TemporalValueDto | null
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
}

export type ReportContainerEntry = {
  readonly id: string
  readonly containerNumber: string
  readonly carrierCode: string | null
  readonly status: string
  readonly eta: TemporalValueDto | null
  readonly latestEvent: TemporalValueDto | null
  readonly latestEventLabel: string | null
  readonly latestTrackingUpdate: string | null
  readonly vesselName: string | null
  readonly hasConflict: boolean
  readonly uncertainty: string | null
  readonly alerts: readonly ReportAlertEntry[]
  readonly timelineSummary: readonly ReportTimelineEntry[]
}

export type ReportProcessEntry = {
  readonly id: string
  readonly reference: string | null
  readonly carrier: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly depositary: string | null
  readonly billOfLading: string | null
  readonly importerName: string | null
  readonly exporterName: string | null
  readonly product: string | null
  readonly redestinationNumber: string | null
  readonly processStatus: string
  readonly alertCount: number
  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
  readonly eta: TemporalValueDto | null
  readonly lastEventAt: TemporalValueDto | null
  readonly lastSyncAt: string | null
  readonly lastSyncStatus: 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN'
  readonly containers: readonly ReportContainerEntry[]
}

export type OperationalSnapshotReport = {
  readonly exportType: 'OPERATIONAL_SNAPSHOT'
  readonly exportedAt: string
  readonly timezone: string
  readonly scope: 'all_processes' | 'single_process'
  readonly filters: {
    readonly processId: string | null
  }
  readonly totals: {
    readonly processCount: number
    readonly containerCount: number
    readonly processesWithAlerts: number
    readonly deliveredProcesses: number
    readonly inTransitProcesses: number
    readonly processesWithConflict: number
    readonly processesWithoutRecentSync: number
  }
  readonly methodologicalNotes: readonly string[]
  readonly processes: readonly ReportProcessEntry[]
}

export type SymmetricExportFormat = 'json' | 'zip'

export type SymmetricExportCommand = {
  readonly scope: 'all_processes' | 'single_process'
  readonly processId: string | null
}

export type ReportExportCommand = {
  readonly scope: 'all_processes' | 'single_process'
  readonly processId: string | null
  readonly includeContainers: boolean
  readonly includeAlerts: boolean
  readonly includeTimelineSummary: boolean
  readonly includeExecutiveSummary: boolean
}
