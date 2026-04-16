import { describe, expect, it } from 'vitest'
import {
  toDashboardAdditionalIncidentsTooltipLine,
  toDashboardEtaCellLabel,
} from '~/modules/process/ui/components/dashboard-process-table.presenter'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function createTranslationStub(
  keys: ReturnType<typeof useTranslation>['keys'],
): (key: string, options?: Record<string, unknown>) => string {
  return (key: string, options?: Record<string, unknown>) => {
    if (key === keys.shipmentView.operational.chips.etaArrived) return 'Chegou'
    if (key === keys.tracking.status.DELIVERED) return 'Entregue'
    if (key === keys.shipmentView.operational.chips.etaMissing) return 'Indisponível'
    if (key === keys.dashboard.table.alertTooltip.additionalAlerts) {
      return `+${String(options?.count ?? 0)} incidente(s) adicional(is)`
    }
    return key
  }
}

describe('toDashboardEtaCellLabel', () => {
  it('formats date ETA display values', () => {
    const { keys } = useTranslation()
    const etaDisplay: ProcessSummaryVM['etaDisplay'] = {
      kind: 'date',
      value: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
    }

    expect(toDashboardEtaCellLabel(etaDisplay, createTranslationStub(keys), keys)).toBe(
      '10/03/2026',
    )
  })

  it('renders delivered ETA state with canonical delivered label', () => {
    const { keys } = useTranslation()
    const etaDisplay: ProcessSummaryVM['etaDisplay'] = {
      kind: 'delivered',
    }

    expect(toDashboardEtaCellLabel(etaDisplay, createTranslationStub(keys), keys)).toBe('Entregue')
  })

  it('renders arrived ETA state with canonical arrived label and formatted date', () => {
    const { keys } = useTranslation()
    const etaDisplay: ProcessSummaryVM['etaDisplay'] = {
      kind: 'arrived',
      value: temporalDtoFromCanonical('2026-03-28'),
    }

    expect(toDashboardEtaCellLabel(etaDisplay, createTranslationStub(keys), keys)).toBe(
      'Chegou 28/03/2026',
    )
  })

  it('renders unavailable ETA state with canonical unavailable label', () => {
    const { keys } = useTranslation()
    const etaDisplay: ProcessSummaryVM['etaDisplay'] = {
      kind: 'unavailable',
    }

    expect(toDashboardEtaCellLabel(etaDisplay, createTranslationStub(keys), keys)).toBe(
      'Indisponível',
    )
  })
})

describe('toDashboardAdditionalIncidentsTooltipLine', () => {
  it('returns null when there are no additional incidents beyond the dominant one', () => {
    const { keys } = useTranslation()
    const t = createTranslationStub(keys)

    expect(toDashboardAdditionalIncidentsTooltipLine(0, t, keys)).toBeNull()
    expect(toDashboardAdditionalIncidentsTooltipLine(1, t, keys)).toBeNull()
  })

  it('formats the tooltip line using additional incident count', () => {
    const { keys } = useTranslation()
    const t = createTranslationStub(keys)

    expect(toDashboardAdditionalIncidentsTooltipLine(4, t, keys)).toBe(
      '+3 incidente(s) adicional(is)',
    )
  })
})
