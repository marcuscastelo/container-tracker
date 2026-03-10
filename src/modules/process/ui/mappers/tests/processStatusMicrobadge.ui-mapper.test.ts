import { describe, expect, it } from 'vitest'
import {
  processStatusMicrobadgeToLabel,
  toProcessStatusMicrobadgeDisplayVM,
  toProcessStatusMicrobadgeVM,
} from '~/modules/process/ui/mappers/processStatusMicrobadge.ui-mapper'
import { useTranslation } from '~/shared/localization/i18n'

describe('processStatusMicrobadge.ui-mapper', () => {
  it('maps valid API payload to microbadge view model', () => {
    expect(
      toProcessStatusMicrobadgeVM({
        status: 'DISCHARGED',
        count: 2,
      }),
    ).toEqual({
      statusCode: 'DISCHARGED',
      count: 2,
    })
  })

  it('returns null for invalid or non-meaningful microbadge payloads', () => {
    expect(
      toProcessStatusMicrobadgeVM({
        status: 'IN_TRANSIT',
        count: 3,
      }),
    ).toBeNull()
    expect(
      toProcessStatusMicrobadgeVM({
        status: 'DELIVERED',
        count: 0,
      }),
    ).toBeNull()
    expect(toProcessStatusMicrobadgeVM(null)).toBeNull()
  })

  it('formats singular/plural labels from i18n keys according to count', () => {
    const { keys } = useTranslation()
    const t = (key: string, options?: Record<string, unknown>): string => {
      const count = typeof options?.count === 'number' ? options.count : 0
      if (key === keys.tracking.statusMicrobadge.DISCHARGED.one) return `${count} descarregado`
      if (key === keys.tracking.statusMicrobadge.DISCHARGED.other) return `${count} descarregados`
      return key
    }

    const singular = processStatusMicrobadgeToLabel({
      t,
      keys,
      microbadge: {
        statusCode: 'DISCHARGED',
        count: 1,
      },
    })
    const plural = processStatusMicrobadgeToLabel({
      t,
      keys,
      microbadge: {
        statusCode: 'DISCHARGED',
        count: 2,
      },
    })

    expect(singular).toBe('1 descarregado')
    expect(plural).toBe('2 descarregados')
  })

  it('builds display microbadge with semantic variant and compact label', () => {
    const { keys } = useTranslation()
    const t = (key: string, options?: Record<string, unknown>): string => {
      const count = typeof options?.count === 'number' ? options.count : 0
      if (key === keys.tracking.statusMicrobadge.ARRIVED_AT_POD.one) return `${count} no POD`
      if (key === keys.tracking.statusMicrobadge.ARRIVED_AT_POD.other) return `${count} no POD`
      return key
    }

    const display = toProcessStatusMicrobadgeDisplayVM({
      t,
      keys,
      microbadge: {
        statusCode: 'ARRIVED_AT_POD',
        count: 1,
      },
    })

    expect(display).toEqual({
      variant: 'amber-500',
      label: '1 no POD',
    })
  })
})
