import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IMPORT_REQUIRES_EMPTY_DATABASE,
  ImportRequiresEmptyDatabaseError,
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
})
