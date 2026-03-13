import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDashboardProcessesCreatedByMonthReadModelUseCase,
  type DashboardProcessesCreatedByMonthReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardProcessesCreatedByMonthReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

afterEach(() => {
  vi.useRealTimers()
})

describe('createDashboardProcessesCreatedByMonthReadModelUseCase', () => {
  it('builds a rolling 6-month window ending in current month and zero-fills missing months', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'))

    const processes: ProcessesProjection = [
      {
        pwc: {
          process: { id: 'process-1', createdAt: new Date('2025-12-02T10:00:00.000Z') },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-2', createdAt: new Date('2026-01-08T10:00:00.000Z') },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-3', createdAt: new Date('2026-03-09T10:00:00.000Z') },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-future', createdAt: new Date('2026-05-20T10:00:00.000Z') },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-4', createdAt: new Date('2025-10-02T10:00:00.000Z') },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))
    const useCase = createDashboardProcessesCreatedByMonthReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary,
      },
    })

    const result = await useCase({ windowSize: 6 })

    expect(result.months).toEqual([
      { month: '2025-10', label: 'Oct', count: 1 },
      { month: '2025-11', label: 'Nov', count: 0 },
      { month: '2025-12', label: 'Dec', count: 1 },
      { month: '2026-01', label: 'Jan', count: 1 },
      { month: '2026-02', label: 'Feb', count: 0 },
      { month: '2026-03', label: 'Mar', count: 1 },
    ])
  })

  it('supports 24-month window ending in current month', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-10T12:00:00.000Z'))

    const processes: ProcessesProjection = [
      {
        pwc: {
          process: { id: 'process-old', createdAt: '2024-02-05T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-current', createdAt: '2026-01-01T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-future', createdAt: '2026-02-01T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))
    const useCase = createDashboardProcessesCreatedByMonthReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary,
      },
    })

    const result = await useCase({ windowSize: 24 })
    const currentMonthEntry = result.months[23]

    expect(result.months).toHaveLength(24)
    expect(result.months[0]?.month).toBe('2024-02')
    expect(currentMonthEntry?.month).toBe('2026-01')
    expect(result.months[23]?.month).toBe('2026-01')
    expect(result.months[0]?.count).toBe(1)
    expect(currentMonthEntry?.count).toBe(1)
  })

  it('handles year boundary and ignores invalid/out-of-window dates for trailing 12-month window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-10T12:00:00.000Z'))

    const processes: ProcessesProjection = [
      {
        pwc: {
          process: { id: 'process-a', createdAt: '2025-08-01T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-b', createdAt: '2025-09-10T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-c', createdAt: '2026-01-05T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-out', createdAt: '2025-01-15T00:00:00.000Z' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
      {
        pwc: {
          process: { id: 'process-invalid', createdAt: 'not-a-date' },
          containers: [],
        },
        summary: { process_status: 'IN_TRANSIT', eta: null },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))
    const useCase = createDashboardProcessesCreatedByMonthReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary,
      },
    })

    const result = await useCase({ windowSize: 12 })

    expect(result.months).toEqual([
      { month: '2025-02', label: 'Feb', count: 0 },
      { month: '2025-03', label: 'Mar', count: 0 },
      { month: '2025-04', label: 'Apr', count: 0 },
      { month: '2025-05', label: 'May', count: 0 },
      { month: '2025-06', label: 'Jun', count: 0 },
      { month: '2025-07', label: 'Jul', count: 0 },
      { month: '2025-08', label: 'Aug', count: 1 },
      { month: '2025-09', label: 'Sep', count: 1 },
      { month: '2025-10', label: 'Oct', count: 0 },
      { month: '2025-11', label: 'Nov', count: 0 },
      { month: '2025-12', label: 'Dec', count: 0 },
      { month: '2026-01', label: 'Jan', count: 1 },
    ])
  })
})
