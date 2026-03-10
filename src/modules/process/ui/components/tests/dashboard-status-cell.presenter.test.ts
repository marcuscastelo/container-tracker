import { describe, expect, it } from 'vitest'
import { toDashboardStatusCellDisplay } from '~/modules/process/ui/components/dashboard-status-cell.presenter'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'

function createStatusSource(
  overrides: Partial<Pick<ProcessSummaryVM, 'status' | 'statusCode' | 'statusMicrobadge'>> = {},
) {
  return {
    status: overrides.status ?? 'blue-500',
    statusCode: overrides.statusCode ?? 'IN_TRANSIT',
    statusMicrobadge: overrides.statusMicrobadge ?? null,
  }
}

function createTranslationStub(
  keys: ReturnType<typeof useTranslation>['keys'],
): (key: string, options?: Record<string, unknown>) => string {
  return (key: string, options?: Record<string, unknown>) => {
    const count = typeof options?.count === 'number' ? options.count : 0
    if (key === keys.tracking.status.IN_TRANSIT) return 'Em trânsito'
    if (key === keys.tracking.statusMicrobadge.DISCHARGED.one) return `${count} descarregado`
    if (key === keys.tracking.statusMicrobadge.DISCHARGED.other) return `${count} descarregados`
    if (key === keys.tracking.statusMicrobadge.DELIVERED.one) return `${count} entregue`
    if (key === keys.tracking.statusMicrobadge.DELIVERED.other) return `${count} entregues`
    return key
  }
}

describe('dashboard-status-cell.presenter', () => {
  it('returns only primary line when microbadge is absent', () => {
    const { keys } = useTranslation()

    const display = toDashboardStatusCellDisplay({
      source: createStatusSource(),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.primary).toEqual({
      label: 'Em trânsito',
      variant: 'blue-500',
    })
    expect(display.subtitle).toBeNull()
  })

  it('returns subtitle line when microbadge exists', () => {
    const { keys } = useTranslation()

    const display = toDashboardStatusCellDisplay({
      source: createStatusSource({
        statusMicrobadge: {
          statusCode: 'DISCHARGED',
          count: 4,
        },
      }),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.subtitle).toEqual({
      label: '4 descarregados',
      textClass: 'text-orange-700',
    })
  })

  it('maps delivered microbadge subtitle to green semantic text class', () => {
    const { keys } = useTranslation()

    const display = toDashboardStatusCellDisplay({
      source: createStatusSource({
        statusMicrobadge: {
          statusCode: 'DELIVERED',
          count: 1,
        },
      }),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.subtitle).toEqual({
      label: '1 entregue',
      textClass: 'text-green-700',
    })
  })

  it('does not return subtitle for redundant or non-meaningful microbadge', () => {
    const { keys } = useTranslation()

    const display = toDashboardStatusCellDisplay({
      source: createStatusSource({
        statusMicrobadge: {
          statusCode: 'IN_TRANSIT',
          count: 2,
        },
      }),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.subtitle).toBeNull()
  })
})
