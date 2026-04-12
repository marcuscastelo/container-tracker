import { describe, expect, it, vi } from 'vitest'
import {
  ImportRequiresEmptyDatabaseError,
  ProcessNotFoundError,
} from '~/capabilities/export-import/application/export-import.errors'
import { createExportImportUseCases } from '~/capabilities/export-import/application/export-import.usecases'
import { Instant } from '~/shared/time/instant'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function createReportProcessEntry(overrides: {
  readonly processId: string
  readonly containerIds: readonly string[]
}): {
  readonly pwc: {
    readonly process: {
      readonly id: string
      readonly reference: string
      readonly origin: string
      readonly destination: string
      readonly depositary: string | null
      readonly carrier: string
      readonly billOfLading: string | null
      readonly importerName: string | null
      readonly exporterName: string | null
      readonly product: string | null
      readonly redestinationNumber: string | null
    }
    readonly containers: readonly {
      readonly id: string
      readonly containerNumber: string
      readonly carrierCode: string | null
    }[]
  }
  readonly summary: {
    readonly process_status: 'AWAITING_DATA' | 'IN_TRANSIT' | 'DELIVERED' | 'EMPTY_RETURNED'
    readonly operational_incidents: {
      readonly summary: {
        readonly active_incidents_count: number
        readonly affected_containers_count: number
        readonly recognized_incidents_count: number
      }
      readonly dominant: null
    }
    readonly eta: string | null
    readonly last_event_at: string | null
  }
  readonly sync: {
    readonly lastSyncAt: string | null
    readonly lastSyncStatus: 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN'
  }
} {
  return {
    pwc: {
      process: {
        id: overrides.processId,
        reference: `REF-${overrides.processId}`,
        origin: 'Santos',
        destination: 'Hamburg',
        depositary: 'CLI',
        carrier: 'MSC',
        billOfLading: null,
        importerName: null,
        exporterName: null,
        product: null,
        redestinationNumber: null,
      },
      containers: overrides.containerIds.map((containerId, index) => ({
        id: containerId,
        containerNumber: `MSCU${index + 1}`,
        carrierCode: 'MSC',
      })),
    },
    summary: {
      process_status: 'IN_TRANSIT',
      operational_incidents: {
        summary: {
          active_incidents_count: 0,
          affected_containers_count: 0,
          recognized_incidents_count: 0,
        },
        dominant: null,
      },
      eta: null,
      last_event_at: null,
    },
    sync: {
      lastSyncAt: null,
      lastSyncStatus: 'UNKNOWN',
    },
  }
}

function createContainerSummary(overrides: {
  readonly hasActualConflict: boolean
  readonly createdAt: string
  readonly eventTime: string
}) {
  return {
    status: 'IN_TRANSIT',
    operational: {
      eta: null,
      dataIssue: false,
    },
    alerts: [],
    observations: [{ created_at: overrides.createdAt }],
    timeline: {
      observations: [
        {
          type: 'LOAD',
          event_time: temporalValueFromCanonical(overrides.eventTime),
          event_time_type: 'ACTUAL',
          seriesHistory: {
            hasActualConflict: overrides.hasActualConflict,
          },
        },
      ],
    },
  }
}

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
            depositary: 'CLI',
            carrier: 'MSC',
            billOfLading: 'BL123',
            bookingNumber: 'BK123',
            importerName: 'Importer',
            exporterName: 'Exporter',
            referenceImporter: 'IMPREF',
            product: 'Coffee',
            redestinationNumber: null,
            source: 'manual',
            createdAt: Instant.fromIso('2026-03-15T00:00:00.000Z'),
            updatedAt: Instant.fromIso('2026-03-15T00:00:00.000Z'),
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
    expect(bundle.processes[0]?.depositary).toBe('CLI')
    expect(bundle.processes[0]?.containers[0]?.containerNumber).toBe('MSCU1111111')
  })

  it('imports symmetric bundle preserving depositary explicitly', async () => {
    const { deps, useCases } = createUseCases()
    vi.mocked(deps.processUseCases.listProcesses).mockResolvedValueOnce({
      processes: [],
    })
    vi.mocked(deps.processUseCases.createProcess).mockResolvedValueOnce({
      process: {
        id: 'created-process-1',
      },
      containers: [],
    })

    await useCases.executeSymmetricImport({
      schemaVersion: '1.0',
      exportType: 'PORTABLE_SYMMETRIC',
      exportedAt: '2026-03-15T00:00:00.000Z',
      metadata: {
        tenant: null,
        processCount: 1,
        containerCount: 0,
        documentCount: 0,
      },
      manifest: {
        schemaVersion: '1.0',
        exportType: 'PORTABLE_SYMMETRIC',
        exportedAt: '2026-03-15T00:00:00.000Z',
        processCount: 1,
        containerCount: 0,
        documentCount: 0,
      },
      processes: [
        {
          importKey: 'process-1',
          reference: 'REF-1',
          origin: 'Santos',
          destination: 'Hamburg',
          depositary: 'CLI',
          carrier: 'MSC',
          billOfLading: null,
          bookingNumber: null,
          importerName: null,
          exporterName: null,
          referenceImporter: null,
          product: null,
          redestinationNumber: null,
          source: 'manual',
          createdAt: '2026-03-15T00:00:00.000Z',
          updatedAt: '2026-03-15T00:00:00.000Z',
          containers: [],
        },
      ],
      documents: [],
    })

    expect(deps.processUseCases.createProcess).toHaveBeenCalledWith({
      record: expect.objectContaining({
        depositary: 'CLI',
      }),
      containers: [],
    })
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

  it('exports report containers without treating every ACTUAL event as a conflict', async () => {
    const { deps, useCases } = createUseCases()

    vi.mocked(deps.processUseCases.listProcessesWithOperationalSummary).mockResolvedValueOnce({
      processes: [
        createReportProcessEntry({
          processId: 'process-1',
          containerIds: ['container-1', 'container-2'],
        }),
      ],
    })

    vi.mocked(deps.trackingUseCases.getContainerSummary).mockImplementation(
      async (containerId: string) => {
        if (containerId === 'container-1') {
          return createContainerSummary({
            hasActualConflict: false,
            createdAt: '2026-03-15T10:00:00.000Z',
            eventTime: '2026-03-15T09:00:00.000Z',
          })
        }

        return createContainerSummary({
          hasActualConflict: true,
          createdAt: '2026-03-15T11:00:00.000Z',
          eventTime: '2026-03-15T10:30:00.000Z',
        })
      },
    )

    const report = await useCases.exportReport({
      scope: 'all_processes',
      processId: null,
      includeContainers: true,
      includeAlerts: false,
      includeTimelineSummary: true,
      includeExecutiveSummary: true,
    })

    const containers = report.processes[0]?.containers ?? []

    expect(containers).toHaveLength(2)
    expect(containers[0]?.id).toBe('container-1')
    expect(containers[0]?.hasConflict).toBe(false)
    expect(containers[1]?.id).toBe('container-2')
    expect(containers[1]?.hasConflict).toBe(true)
    expect(report.totals.processesWithConflict).toBe(1)
  })

  it('throws not-found when a single-process report targets a missing process', async () => {
    const { deps, useCases } = createUseCases()

    vi.mocked(deps.processUseCases.listProcessesWithOperationalSummary).mockResolvedValueOnce({
      processes: [
        createReportProcessEntry({
          processId: 'process-1',
          containerIds: [],
        }),
      ],
    })

    await expect(
      useCases.exportReport({
        scope: 'single_process',
        processId: 'missing-process',
        includeContainers: false,
        includeAlerts: false,
        includeTimelineSummary: false,
        includeExecutiveSummary: false,
      }),
    ).rejects.toBeInstanceOf(ProcessNotFoundError)
  })
})
