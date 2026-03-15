import { describe, expect, it, vi } from 'vitest'
import { ImportRequiresEmptyDatabaseError } from '~/capabilities/export-import/application/export-import.errors'
import { createExportImportUseCases } from '~/capabilities/export-import/application/export-import.usecases'

function createUseCases() {
  const deps = {
    processUseCases: {
      listProcesses: vi.fn(),
      listProcessesWithContainers: vi.fn(),
      findProcessByIdWithContainers: vi.fn(),
      listProcessesWithOperationalSummary: vi.fn(),
      createProcess: vi.fn(),
      deleteProcess: vi.fn(),
    },
    trackingUseCases: {
      getContainerSummary: vi.fn(),
    },
  }

  return {
    deps,
    useCases: createExportImportUseCases(deps),
  }
}

describe('export-import usecases', () => {
  it('exports symmetric bundle with structural data only', async () => {
    const { deps, useCases } = createUseCases()
    vi.mocked(deps.processUseCases.listProcessesWithContainers).mockResolvedValueOnce({
      processes: [
        {
          process: {
            id: 'process-1',
            reference: 'REF-1',
            origin: 'Santos',
            destination: 'Hamburg',
            carrier: 'MSC',
            billOfLading: 'BL123',
            bookingNumber: 'BK123',
            importerName: 'Importer',
            exporterName: 'Exporter',
            referenceImporter: 'IMPREF',
            product: 'Coffee',
            redestinationNumber: null,
            source: 'manual',
            createdAt: new Date('2026-03-15T00:00:00.000Z'),
            updatedAt: new Date('2026-03-15T00:00:00.000Z'),
          },
          containers: [
            {
              id: 'container-1',
              processId: 'process-1',
              containerNumber: 'MSCU1111111',
              carrierCode: 'MSC',
            },
          ],
        },
      ],
    })

    const bundle = await useCases.exportSymmetric({
      scope: 'all_processes',
      processId: null,
    })

    expect(bundle.schemaVersion).toBe('1.0')
    expect(bundle.exportType).toBe('PORTABLE_SYMMETRIC')
    expect(bundle.processes).toHaveLength(1)
    expect(bundle.documents).toEqual([])
    expect(bundle.processes[0]?.containers[0]?.containerNumber).toBe('MSCU1111111')
  })

  it('blocks validation when database is not empty', async () => {
    const { deps, useCases } = createUseCases()
    vi.mocked(deps.processUseCases.listProcesses).mockResolvedValueOnce({
      processes: [
        {
          id: 'existing',
        },
      ],
    })

    const result = await useCases.validateSymmetricImport({
      schemaVersion: '1.0',
      exportType: 'PORTABLE_SYMMETRIC',
      exportedAt: '2026-03-15T00:00:00.000Z',
      metadata: {
        tenant: null,
        processCount: 0,
        containerCount: 0,
        documentCount: 0,
      },
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

    expect(result.databaseEmpty).toBe(false)
    expect(result.canImport).toBe(false)
    expect(result.errors.some((error) => error.includes('IMPORT_REQUIRES_EMPTY_DATABASE'))).toBe(
      true,
    )
  })

  it('throws explicit empty-db error on execute when db has data', async () => {
    const { deps, useCases } = createUseCases()
    vi.mocked(deps.processUseCases.listProcesses).mockResolvedValueOnce({
      processes: [
        {
          id: 'existing',
        },
      ],
    })

    await expect(
      useCases.executeSymmetricImport({
        schemaVersion: '1.0',
        exportType: 'PORTABLE_SYMMETRIC',
        exportedAt: '2026-03-15T00:00:00.000Z',
        metadata: {
          tenant: null,
          processCount: 0,
          containerCount: 0,
          documentCount: 0,
        },
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
      }),
    ).rejects.toBeInstanceOf(ImportRequiresEmptyDatabaseError)
  })
})
