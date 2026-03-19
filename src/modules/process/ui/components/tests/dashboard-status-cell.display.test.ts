import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createDashboardStatusCellDisplayMemo } from '~/modules/process/ui/components/dashboard-status-cell.display'
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
  translationKeys: ReturnType<typeof useTranslation>['keys'],
): (key: string, options?: Record<string, unknown>) => string {
  return (key: string, options?: Record<string, unknown>) => {
    const count = typeof options?.count === 'number' ? options.count : 0
    if (key === translationKeys.tracking.status.IN_TRANSIT) return 'Em trânsito'
    if (key === translationKeys.tracking.statusMicrobadge.DISCHARGED.one)
      return `${count} descarregado`
    if (key === translationKeys.tracking.statusMicrobadge.DISCHARGED.other)
      return `${count} descarregados`
    return key
  }
}

describe('dashboard-status-cell.display', () => {
  it('memoizes presenter output across repeated reads in the same render path', () => {
    const { keys } = useTranslation()
    const translate = createTranslationStub(keys)
    const buildDisplay = vi.fn(toDashboardStatusCellDisplay)
    const source = createStatusSource({
      statusMicrobadge: {
        statusCode: 'DISCHARGED',
        count: 2,
      },
    })

    createRoot((dispose) => {
      try {
        const display = createDashboardStatusCellDisplayMemo({
          getCommand: () => ({
            source,
            t: translate,
            keys,
          }),
          buildDisplay,
        })

        const initial = display()
        const repeated = display()

        expect(buildDisplay).toHaveBeenCalledTimes(1)
        expect(repeated).toBe(initial)
        expect(initial.subtitle).toEqual({
          label: '2 descarregados',
          textClass: 'text-tone-warning-fg',
        })
      } finally {
        dispose()
      }
    })
  })
})
