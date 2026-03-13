import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardKpisReadModelUseCase,
  type DashboardKpisReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.kpis.readmodel'

type ProcessesProjection = Awaited<
  ReturnType<DashboardKpisReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']>
>['processes']

describe('createDashboardKpisReadModelUseCase', () => {
  it('counts active processes, tracked containers, processes with alerts and latest sync', async () => {
    const processes: ProcessesProjection = [
      {
        pwc: {
          process: { id: 'process-1' },
          containers: [
            { id: 'container-1', containerNumber: 'MSCU1000001' },
            { id: 'container-2', containerNumber: 'MSCU1000002' },
          ],
        },
        summary: {
          full_logistics_complete: false,
          alerts_count: 2,
        },
        sync: {
          lastSyncAt: '2026-03-12T10:00:00.000Z',
        },
      },
      {
        pwc: {
          process: { id: 'process-2' },
          containers: [{ id: 'container-3', containerNumber: 'MSCU1000003' }],
        },
        summary: {
          full_logistics_complete: true,
          alerts_count: 0,
        },
        sync: {
          lastSyncAt: '2026-03-12T11:30:00.000Z',
        },
      },
      {
        pwc: {
          process: { id: 'process-3' },
          containers: [],
        },
        summary: {
          full_logistics_complete: false,
          alerts_count: 1,
        },
        sync: {
          lastSyncAt: null,
        },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))

    const useCase = createDashboardKpisReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary,
      },
    })

    const result = await useCase()

    expect(result).toEqual({
      activeProcesses: 2,
      trackedContainers: 3,
      processesWithAlerts: 2,
      lastSyncAt: '2026-03-12T11:30:00.000Z',
    })
  })

  it('returns null lastSyncAt when all process sync timestamps are null or invalid', async () => {
    const processes: ProcessesProjection = [
      {
        pwc: {
          process: { id: 'process-1' },
          containers: [{ id: 'container-1', containerNumber: 'MSCU2000001' }],
        },
        summary: {
          full_logistics_complete: false,
          alerts_count: 0,
        },
        sync: {
          lastSyncAt: null,
        },
      },
      {
        pwc: {
          process: { id: 'process-2' },
          containers: [],
        },
        summary: {
          full_logistics_complete: false,
          alerts_count: 0,
        },
        sync: {
          lastSyncAt: 'invalid-date',
        },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))

    const useCase = createDashboardKpisReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary,
      },
    })

    const result = await useCase()

    expect(result.lastSyncAt).toBeNull()
    expect(result.activeProcesses).toBe(2)
    expect(result.trackedContainers).toBe(1)
    expect(result.processesWithAlerts).toBe(0)
  })
})
