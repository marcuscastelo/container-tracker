import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IMPORT_REQUIRES_EMPTY_DATABASE,
  ImportRequiresEmptyDatabaseError,
  ProcessNotFoundError,
} from '~/capabilities/export-import/application/export-import.errors'
import type { ExportImportUseCases } from '~/capabilities/export-import/application/export-import.usecases'
import { createExportImportControllers } from '~/capabilities/export-import/interface/http/export-import.controllers'

function createUseCasesMock(): ExportImportUseCases {
  return {
    exportSymmetric: vi.fn(),
    validateSymmetricImport: vi.fn(),
    executeSymmetricImport: vi.fn(),
    exportReport: vi.fn(),
  }
}

describe('export import controllers', () => {
  const useCases = createUseCasesMock()
  const controllers = createExportImportControllers({
    exportImportUseCases: useCases,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns explicit import-empty-db error payload on execute endpoint', async () => {
    vi.mocked(useCases.executeSymmetricImport).mockRejectedValueOnce(
      new ImportRequiresEmptyDatabaseError(),
    )

    const response = await controllers.executeSymmetricImport({
      request: new Request('http://localhost/api/export-import/symmetric/import/execute', {
        method: 'POST',
        body: JSON.stringify({
          bundle: {
            schemaVersion: '1.0',
            exportType: 'PORTABLE_SYMMETRIC',
            exportedAt: new Date().toISOString(),
            metadata: { tenant: null, processCount: 0, containerCount: 0, documentCount: 0 },
            manifest: {
              schemaVersion: '1.0',
              exportType: 'PORTABLE_SYMMETRIC',
              exportedAt: new Date().toISOString(),
              processCount: 0,
              containerCount: 0,
              documentCount: 0,
            },
            processes: [],
            documents: [],
          },
        }),
      }),
    })

    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.code).toBe(IMPORT_REQUIRES_EMPTY_DATABASE)
  })

  it('streams symmetric export file with attachment header', async () => {
    vi.mocked(useCases.exportSymmetric).mockResolvedValueOnce({
      schemaVersion: '1.0',
      exportType: 'PORTABLE_SYMMETRIC',
      exportedAt: '2026-03-15T00:00:00.000Z',
      metadata: { tenant: null, processCount: 0, containerCount: 0, documentCount: 0 },
      manifest: {
        schemaVersion: '1.0',
        exportType: 'PORTABLE_SYMMETRIC',
        exportedAt: '2026-03-15T00:00:00.000Z',
        processCount: 0,
        containerCount: 0,
        documentCount: 0,
      },
      processes: [],
      documents: [],
    })

    const response = await controllers.exportSymmetric({
      request: new Request('http://localhost/api/export-import/symmetric/export', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'all_processes',
          format: 'json',
        }),
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('attachment; filename=')
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })

  it('returns not-found when report export targets a missing process', async () => {
    vi.mocked(useCases.exportReport).mockRejectedValueOnce(
      new ProcessNotFoundError('Process not found for report export'),
    )

    const response = await controllers.exportReport({
      request: new Request('http://localhost/api/export-import/report/export', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'single_process',
          processId: 'missing-process',
          format: 'json',
        }),
      }),
    })

    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toContain('Process not found')
  })

  it('streams trello markdown export as an attachment', async () => {
    vi.mocked(useCases.exportReport).mockResolvedValueOnce({
      exportType: 'OPERATIONAL_SNAPSHOT',
      exportedAt: '2026-03-15T10:00:00.000Z',
      timezone: 'UTC',
      scope: 'single_process',
      filters: {
        processId: 'process-1',
      },
      totals: {
        processCount: 1,
        containerCount: 1,
        processesWithAlerts: 0,
        deliveredProcesses: 0,
        inTransitProcesses: 1,
        processesWithConflict: 0,
        processesWithoutRecentSync: 0,
      },
      methodologicalNotes: [],
      processes: [
        {
          id: 'process-1',
          reference: 'CA064-25',
          carrier: 'MSC',
          origin: 'Paquistão',
          destination: 'Santos',
          billOfLading: 'MEDUP6003834',
          importerName: 'FLUSH',
          exporterName: 'WAQAS',
          product: 'SAL',
          redestinationNumber: '128598',
          processStatus: 'ARRIVED_AT_POD',
          alertCount: 0,
          highestAlertSeverity: null,
          eta: '2026-04-30T00:00:00.000Z',
          lastEventAt: '2026-04-20T16:18:00.000Z',
          lastSyncAt: '2026-04-20T16:18:00.000Z',
          lastSyncStatus: 'DONE',
          containers: [
            {
              id: 'container-1',
              containerNumber: 'FCIU2000205',
              carrierCode: 'MSC',
              status: 'IN_TRANSIT',
              eta: '2026-04-30T00:00:00.000Z',
              latestEvent: '2026-04-20T16:18:00.000Z',
              latestEventLabel: 'Discharged at destination port',
              latestTrackingUpdate: '2026-04-20T16:18:00.000Z',
              vesselName: 'MSC BIANCA SILVIA',
              hasConflict: false,
              uncertainty: null,
              alerts: [],
              timelineSummary: [],
            },
          ],
        },
      ],
    })

    const response = await controllers.exportReport({
      request: new Request('http://localhost/api/export-import/report/export', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'single_process',
          processId: 'process-1',
          format: 'trello',
        }),
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('snapshot-CA064-25.md')
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    await expect(response.text()).resolves.toContain('# CA064-25')
  })
})
