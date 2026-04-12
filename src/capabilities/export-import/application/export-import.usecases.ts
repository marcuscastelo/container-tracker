import {
  ImportRequiresEmptyDatabaseError,
  InvalidSymmetricBundleError,
  ProcessNotFoundError,
} from '~/capabilities/export-import/application/export-import.errors'
import type {
  OperationalSnapshotReport,
  ReportAlertEntry,
  ReportContainerEntry,
  ReportExportCommand,
  ReportProcessEntry,
  ReportTimelineEntry,
  SymmetricContainerEntry,
  SymmetricExportBundle,
  SymmetricExportCommand,
  SymmetricImportExecutionResult,
  SymmetricImportValidationResult,
} from '~/capabilities/export-import/application/export-import.models'
import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import { systemClock } from '~/shared/time/clock'
import { compareTemporal } from '~/shared/time/compare-temporal'
import { type TemporalValueDto, toTemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'
import type { TemporalValue } from '~/shared/time/temporal-value'

// 24 hours in milliseconds — threshold for considering process sync as recent.
const FRESH_SYNC_WINDOW_MS = 1000 * 60 * 60 * 24
const REPORT_PROCESS_CONCURRENCY = 4
const REPORT_CONTAINER_CONCURRENCY = 4

type ExportImportUseCasesDeps = {
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
}

function isSymmetricImportKeyDuplicate(
  entries: readonly { readonly importKey: string }[],
): boolean {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.importKey)) return true
    seen.add(entry.importKey)
  }
  return false
}

function getLatestEventFromTimelineItems(
  timelineItems: readonly { readonly event_time: TemporalValue | null }[],
): TemporalValueDto | null {
  let latest: TemporalValue | null = null
  for (const item of timelineItems) {
    if (item.event_time === null) continue
    if (latest === null) {
      latest = item.event_time
      continue
    }

    if (
      compareTemporal(item.event_time, latest, {
        timezone: 'UTC',
        strategy: 'start-of-day',
      }) > 0
    ) {
      latest = item.event_time
    }
  }
  return latest === null ? null : toTemporalValueDto(latest)
}

type ReportContainerObservation = {
  readonly type: string
  readonly event_time: string | null
  readonly carrier_label?: string | null
  readonly vessel_name?: string | null
  readonly created_at: string
}

function toTimestampOrNegativeInfinity(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function getLatestObservationInfo(observations: readonly ReportContainerObservation[]): {
  readonly eventTime: string | null
  readonly eventLabel: string | null
  readonly vesselName: string | null
} {
  let latestObservation: ReportContainerObservation | null = null
  let latestEventTime = Number.NEGATIVE_INFINITY
  let latestCreatedAt = Number.NEGATIVE_INFINITY

  for (const observation of observations) {
    const eventTime = toTimestampOrNegativeInfinity(observation.event_time)
    const createdAt = toTimestampOrNegativeInfinity(observation.created_at)

    if (latestObservation === null) {
      latestObservation = observation
      latestEventTime = eventTime
      latestCreatedAt = createdAt
      continue
    }

    if (
      eventTime > latestEventTime ||
      (eventTime === latestEventTime && createdAt > latestCreatedAt)
    ) {
      latestObservation = observation
      latestEventTime = eventTime
      latestCreatedAt = createdAt
    }
  }

  if (latestObservation === null) {
    return {
      eventTime: null,
      eventLabel: null,
      vesselName: null,
    }
  }

  const carrierLabel = latestObservation.carrier_label?.trim() ?? ''
  const vesselName = latestObservation.vessel_name?.trim() ?? ''

  return {
    eventTime: latestObservation.event_time,
    eventLabel: carrierLabel.length > 0 ? carrierLabel : latestObservation.type,
    vesselName: vesselName.length > 0 ? vesselName : null,
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      const currentItem = items[currentIndex]
      if (currentItem === undefined) continue

      results[currentIndex] = await mapper(currentItem, currentIndex)
    }
  })

  await Promise.all(workers)
  return results
}

function deriveContainerConflictSignal(
  timelineItems: readonly {
    readonly event_time_type: 'ACTUAL' | 'EXPECTED'
    readonly seriesHistory?: { readonly hasActualConflict: boolean } | null
  }[],
): boolean {
  return timelineItems.some((item) => item.seriesHistory?.hasActualConflict === true)
}

type ContainerSummaryAlert = {
  readonly id: string
  readonly category: 'fact' | 'monitoring'
  readonly type: string
  readonly severity: 'info' | 'warning' | 'danger'
  readonly message_key: string
  readonly triggered_at: string
  readonly retroactive: boolean
}

function toReportAlert(alert: ContainerSummaryAlert): ReportAlertEntry {
  return {
    id: alert.id,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    messageKey: alert.message_key,
    triggeredAt: alert.triggered_at,
    retroactive: alert.retroactive,
  }
}

function toReportTimelineItem(
  timelineItems: readonly {
    readonly type: string
    readonly event_time: TemporalValue | null
    readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  }[],
): readonly ReportTimelineEntry[] {
  return timelineItems.slice(-5).map((item) => ({
    type: item.type,
    eventTime: item.event_time === null ? null : toTemporalValueDto(item.event_time),
    eventTimeType: item.event_time_type,
  }))
}

function assertNonEmptyProcessIdWhenSingleScope(command: {
  readonly scope: 'all_processes' | 'single_process'
  readonly processId: string | null
}): void {
  if (command.scope === 'single_process' && (command.processId ?? '').trim().length === 0) {
    throw new InvalidSymmetricBundleError('processId is required for single_process scope')
  }
}

async function resolveProcessesForSymmetricExport(
  deps: ExportImportUseCasesDeps,
  command: SymmetricExportCommand,
) {
  if (command.scope === 'all_processes') {
    const result = await deps.processUseCases.listProcessesWithContainers()
    return result.processes
  }

  const processId = command.processId
  if (!processId) {
    throw new InvalidSymmetricBundleError('processId is required for single_process scope')
  }

  const result = await deps.processUseCases.findProcessByIdWithContainers({ processId })
  if (!result.process) {
    throw new InvalidSymmetricBundleError('Process not found for symmetric export')
  }

  return [result.process]
}

async function resolveProcessesForReport(
  deps: ExportImportUseCasesDeps,
  command: ReportExportCommand,
) {
  const result = await deps.processUseCases.listProcessesWithOperationalSummary()
  if (command.scope === 'all_processes') {
    return result.processes
  }

  const processId = command.processId
  if (!processId) {
    throw new InvalidSymmetricBundleError('processId is required for single_process scope')
  }

  const matchingProcesses = result.processes.filter(
    (entry) => String(entry.pwc.process.id) === processId,
  )

  if (matchingProcesses.length === 0) {
    throw new ProcessNotFoundError('Process not found for report export')
  }

  return matchingProcesses
}

async function buildReportContainerEntry(
  deps: ExportImportUseCasesDeps,
  container: {
    readonly id: string
    readonly containerNumber: string
    readonly carrierCode: string | null
  },
  now: Instant,
  command: Pick<ReportExportCommand, 'includeAlerts' | 'includeTimelineSummary'>,
): Promise<ReportContainerEntry> {
  const summary = await deps.trackingUseCases.getContainerSummary(
    String(container.id),
    String(container.containerNumber),
    undefined,
    now,
    {
      includeAcknowledgedAlerts: true,
    },
  )

  const latestEvent = getLatestEventFromTimelineItems(summary.timeline.observations)
  const latestObservation = getLatestObservationInfo(
    summary.observations.map((o) => ({
      type: o.type,
      event_time: o.event_time ? toTemporalValueDto(o.event_time).value : null,
      carrier_label: o.carrier_label ?? null,
      vessel_name: o.vessel_name ?? null,
      created_at: o.created_at,
    })),
  )
  const timelineSummary = command.includeTimelineSummary
    ? toReportTimelineItem(summary.timeline.observations)
    : []
  const alertItems = command.includeAlerts ? summary.alerts.map(toReportAlert) : []

  const latestTrackingUpdate =
    summary.observations.length > 0
      ? summary.observations.reduce((latest, observation) =>
          observation.created_at > latest.created_at ? observation : latest,
        ).created_at
      : null

  return {
    id: String(container.id),
    containerNumber: String(container.containerNumber),
    carrierCode: container.carrierCode,
    status: summary.status,
    eta: summary.operational.eta?.eventTime ?? null,
    latestEvent,
    latestEventLabel: latestObservation.eventLabel,
    latestTrackingUpdate,
    vesselName: latestObservation.vesselName,
    hasConflict: deriveContainerConflictSignal(summary.timeline.observations),
    uncertainty: summary.operational.dataIssue === true ? 'tracking_summary_data_issue' : null,
    alerts: alertItems,
    timelineSummary,
  }
}

function validateSymmetricBundle(bundle: SymmetricExportBundle): SymmetricImportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (bundle.schemaVersion.trim().length === 0) {
    errors.push('schemaVersion is required')
  }

  if (bundle.exportType !== 'PORTABLE_SYMMETRIC') {
    errors.push('exportType must be PORTABLE_SYMMETRIC')
  }

  if (bundle.processes.length === 0) {
    warnings.push('Bundle has no processes')
  }

  if (isSymmetricImportKeyDuplicate(bundle.processes)) {
    errors.push('Duplicate process importKey detected in bundle')
  }

  const allContainers: SymmetricContainerEntry[] = []
  const processIds = new Set(bundle.processes.map((processEntry) => processEntry.importKey))
  for (const processEntry of bundle.processes) {
    if (processEntry.containers.length === 0) {
      warnings.push(`Process ${processEntry.importKey} has no containers`)
    }

    for (const container of processEntry.containers) {
      if (!processIds.has(container.processImportKey)) {
        errors.push(`Container ${container.importKey} references unknown process importKey`)
      }
      allContainers.push(container)
    }
  }

  if (isSymmetricImportKeyDuplicate(allContainers)) {
    errors.push('Duplicate container importKey detected in bundle')
  }

  for (const document of bundle.documents) {
    if (!processIds.has(document.processImportKey)) {
      errors.push(`Document ${document.importKey} references unknown process importKey`)
    }
  }

  return {
    canImport: errors.length === 0,
    schemaVersion: bundle.schemaVersion,
    processCount: bundle.processes.length,
    containerCount: allContainers.length,
    documentCount: bundle.documents.length,
    databaseEmpty: true,
    errors,
    warnings,
  }
}

function withDatabaseStatus(
  result: SymmetricImportValidationResult,
  databaseEmpty: boolean,
): SymmetricImportValidationResult {
  if (!databaseEmpty) {
    return {
      ...result,
      canImport: false,
      databaseEmpty,
      errors: [
        ...result.errors,
        'IMPORT_REQUIRES_EMPTY_DATABASE: Symmetric import v1 requires an empty process database. Remove existing processes before importing.',
      ],
    }
  }

  return {
    ...result,
    databaseEmpty,
  }
}

export function createExportImportUseCases(deps: ExportImportUseCasesDeps) {
  async function exportSymmetric(command: SymmetricExportCommand): Promise<SymmetricExportBundle> {
    assertNonEmptyProcessIdWhenSingleScope(command)

    const processes = await resolveProcessesForSymmetricExport(deps, command)
    const exportedAt = systemClock.now().toIsoString()

    const processEntries = processes.map((entry) => {
      const processImportKey = String(entry.process.id)
      return {
        importKey: processImportKey,
        reference: entry.process.reference,
        origin: entry.process.origin,
        destination: entry.process.destination,
        depositary: entry.process.depositary,
        carrier: entry.process.carrier,
        billOfLading: entry.process.billOfLading,
        bookingNumber: entry.process.bookingNumber,
        importerName: entry.process.importerName,
        exporterName: entry.process.exporterName,
        referenceImporter: entry.process.referenceImporter,
        product: entry.process.product,
        redestinationNumber: entry.process.redestinationNumber,
        source: entry.process.source,
        createdAt: entry.process.createdAt.toIsoString(),
        updatedAt: entry.process.updatedAt.toIsoString(),
        containers: entry.containers.map((container) => ({
          importKey: String(container.id),
          processImportKey,
          containerNumber: String(container.containerNumber),
          carrierCode: container.carrierCode,
        })),
      }
    })

    const containerCount = processEntries.reduce(
      (sum, processEntry) => sum + processEntry.containers.length,
      0,
    )

    return {
      schemaVersion: '1.0',
      exportType: 'PORTABLE_SYMMETRIC',
      exportedAt,
      metadata: {
        tenant: null,
        processCount: processEntries.length,
        containerCount,
        documentCount: 0,
      },
      manifest: {
        schemaVersion: '1.0',
        exportType: 'PORTABLE_SYMMETRIC',
        exportedAt,
        processCount: processEntries.length,
        containerCount,
        documentCount: 0,
      },
      processes: processEntries,
      documents: [],
    }
  }

  async function validateSymmetricImport(
    bundle: SymmetricExportBundle,
  ): Promise<SymmetricImportValidationResult> {
    const validation = validateSymmetricBundle(bundle)
    const current = await deps.processUseCases.listProcesses()
    const databaseEmpty = current.processes.length === 0
    return withDatabaseStatus(validation, databaseEmpty)
  }

  async function executeSymmetricImport(
    bundle: SymmetricExportBundle,
  ): Promise<SymmetricImportExecutionResult> {
    const validation = await validateSymmetricImport(bundle)

    if (!validation.databaseEmpty) {
      throw new ImportRequiresEmptyDatabaseError()
    }

    if (validation.errors.length > 0) {
      throw new InvalidSymmetricBundleError(validation.errors.join('; '))
    }

    const createdProcessIds: string[] = []
    const rollbackFailures: string[] = []
    let importedContainers = 0

    try {
      for (const processEntry of bundle.processes) {
        const created = await deps.processUseCases.createProcess({
          record: {
            reference: processEntry.reference,
            origin: processEntry.origin,
            destination: processEntry.destination,
            depositary: processEntry.depositary,
            carrier: processEntry.carrier ?? 'unknown',
            bill_of_lading: processEntry.billOfLading,
            booking_number: processEntry.bookingNumber,
            importer_name: processEntry.importerName,
            exporter_name: processEntry.exporterName,
            reference_importer: processEntry.referenceImporter,
            product: processEntry.product,
            redestination_number: processEntry.redestinationNumber,
            source: processEntry.source,
          },
          containers: processEntry.containers.map((container) => ({
            container_number: container.containerNumber,
            carrier_code: container.carrierCode,
          })),
        })

        createdProcessIds.push(String(created.process.id))
        importedContainers += created.containers.length
      }

      return {
        importedProcesses: bundle.processes.length,
        importedContainers,
        importedDocuments: 0,
      }
    } catch (error) {
      for (const processId of createdProcessIds.reverse()) {
        try {
          await deps.processUseCases.deleteProcess({ processId })
        } catch (rollbackError) {
          console.error('Failed to rollback imported process', rollbackError)
          rollbackFailures.push(processId)
        }
      }
      if (rollbackFailures.length > 0) {
        const originalMessage = error instanceof Error ? error.message : String(error)
        throw new InvalidSymmetricBundleError(
          `${originalMessage}; rollback_failed_process_ids=${rollbackFailures.join(',')}`,
        )
      }
      throw error
    }
  }

  async function exportReport(command: ReportExportCommand): Promise<OperationalSnapshotReport> {
    assertNonEmptyProcessIdWhenSingleScope(command)

    const now = systemClock.now()
    const exportedAt = now.toIsoString()
    const entries = await resolveProcessesForReport(deps, command)

    const reportProcesses: ReportProcessEntry[] = await mapWithConcurrency(
      entries,
      REPORT_PROCESS_CONCURRENCY,
      async (entry) => {
        const containers: ReportContainerEntry[] = command.includeContainers
          ? await mapWithConcurrency(
              entry.pwc.containers,
              REPORT_CONTAINER_CONCURRENCY,
              async (container) =>
                buildReportContainerEntry(deps, container, now, {
                  includeAlerts: command.includeAlerts,
                  includeTimelineSummary: command.includeTimelineSummary,
                }),
            )
          : []

        return {
          id: String(entry.pwc.process.id),
          reference: entry.pwc.process.reference,
          carrier: entry.pwc.process.carrier,
          origin: entry.pwc.process.origin,
          destination: entry.pwc.process.destination,
          depositary: entry.pwc.process.depositary,
          billOfLading: entry.pwc.process.billOfLading,
          importerName: entry.pwc.process.importerName,
          exporterName: entry.pwc.process.exporterName,
          product: entry.pwc.process.product,
          redestinationNumber: entry.pwc.process.redestinationNumber,
          processStatus: entry.summary.process_status,
          activeIncidentCount: entry.summary.operational_incidents.summary.active_incidents_count,
          affectedContainerCount:
            entry.summary.operational_incidents.summary.affected_containers_count,
          dominantIncidentSeverity: entry.summary.operational_incidents.dominant?.severity ?? null,
          eta: entry.summary.eta,
          lastEventAt: entry.summary.last_event_at,
          lastSyncAt: entry.sync.lastSyncAt,
          lastSyncStatus: entry.sync.lastSyncStatus,
          containers,
        }
      },
    )

    const processCount = reportProcesses.length
    const containerCount = reportProcesses.reduce(
      (sum, processEntry) => sum + processEntry.containers.length,
      0,
    )
    const executiveSource = command.includeExecutiveSummary ? reportProcesses : []
    const nowMs = now.toEpochMs()

    return {
      exportType: 'OPERATIONAL_SNAPSHOT',
      exportedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      scope: command.scope,
      filters: {
        processId: command.scope === 'single_process' ? command.processId : null,
      },
      totals: {
        processCount,
        containerCount,
        processesWithActiveIncidents: executiveSource.filter(
          (processEntry) => processEntry.activeIncidentCount > 0,
        ).length,
        deliveredProcesses: executiveSource.filter(
          (processEntry) =>
            processEntry.processStatus === 'DELIVERED' ||
            processEntry.processStatus === 'EMPTY_RETURNED',
        ).length,
        inTransitProcesses: executiveSource.filter(
          (processEntry) => processEntry.processStatus === 'IN_TRANSIT',
        ).length,
        processesWithConflict: executiveSource.filter((processEntry) =>
          processEntry.containers.some((container) => container.hasConflict),
        ).length,
        processesWithoutRecentSync: executiveSource.filter((processEntry) => {
          if (processEntry.lastSyncAt === null) return true
          const syncAtMs = parseInstantFromIso(processEntry.lastSyncAt)?.toEpochMs()
          if (syncAtMs === undefined) return true
          return nowMs - syncAtMs > FRESH_SYNC_WINDOW_MS
        }).length,
      },
      methodologicalNotes: [
        'Status and operational incidents are derived backend projections at export time.',
        'Monitoring incidents are time-dependent and reflect the export instant.',
        'Conflicts and uncertainties are intentionally preserved and not hidden.',
      ],
      processes: reportProcesses,
    }
  }

  return {
    exportSymmetric,
    validateSymmetricImport,
    executeSymmetricImport,
    exportReport,
  }
}

export type ExportImportUseCases = ReturnType<typeof createExportImportUseCases>
