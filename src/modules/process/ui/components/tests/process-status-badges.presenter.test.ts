import { describe, expect, it } from 'vitest'
import { toProcessStatusBadgesDisplay } from '~/modules/process/ui/components/process-status-badges.presenter'
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
    if (key === keys.tracking.status.DISCHARGED) return 'Descarregado'
    if (key === keys.tracking.statusMicrobadge.DISCHARGED.one) return `${count} descarregado`
    if (key === keys.tracking.statusMicrobadge.DISCHARGED.other) return `${count} descarregados`
    return key
  }
}

describe('process-status-badges.presenter', () => {
  it('returns primary badge only when there is no microbadge', () => {
    const { keys } = useTranslation()
    const display = toProcessStatusBadgesDisplay({
      source: createStatusSource(),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.primary).toEqual({
      label: 'Em trânsito',
      variant: 'blue-500',
    })
    expect(display.microbadge).toBeNull()
  })

  it('returns primary + microbadge display when process has an advanced subset status', () => {
    const { keys } = useTranslation()
    const display = toProcessStatusBadgesDisplay({
      source: createStatusSource({
        statusMicrobadge: {
          statusCode: 'DISCHARGED',
          count: 2,
        },
      }),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.primary.label).toBe('Em trânsito')
    expect(display.microbadge).toEqual({
      label: '2 descarregados',
      variant: 'orange-500',
    })
  })

  it('does not return redundant microbadge when status is not meaningful', () => {
    const { keys } = useTranslation()
    const display = toProcessStatusBadgesDisplay({
      source: createStatusSource({
        statusMicrobadge: {
          statusCode: 'IN_TRANSIT',
          count: 3,
        },
      }),
      t: createTranslationStub(keys),
      keys,
    })

    expect(display.primary.label).toBe('Em trânsito')
    expect(display.microbadge).toBeNull()
  })
})
