import { describe, expect, it } from 'vitest'
import { toDashboardMonthlyBarDatumVMs } from '~/modules/process/ui/mappers/dashboard-processes-created-by-month.ui-mapper'

describe('toDashboardMonthlyBarDatumVMs', () => {
  it('maps monthly chart dto to chart datum view model with locale-aware labels', () => {
    const octoberLabel = new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2025, 9, 1)))
    const novemberLabel = new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2025, 10, 1)))

    const result = toDashboardMonthlyBarDatumVMs(
      {
        months: [
          { month: '2025-10', label: 'Oct', count: 4 },
          { month: '2025-11', label: 'Nov', count: 7 },
        ],
      },
      'pt-BR',
    )

    expect(result).toEqual([
      { key: '2025-10', label: octoberLabel, value: 4 },
      { key: '2025-11', label: novemberLabel, value: 7 },
    ])
  })
})
