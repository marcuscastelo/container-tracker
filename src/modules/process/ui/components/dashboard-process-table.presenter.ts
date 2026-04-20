import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import type { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

export function toDashboardEtaCellLabel(
  etaDisplay: ProcessSummaryVM['etaDisplay'],
  t: (key: string, opts?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (etaDisplay.kind === 'arrived') {
    return `${t(keys.shipmentView.operational.chips.etaArrived)} ${formatDateForLocale(etaDisplay.value)}`
  }

  if (etaDisplay.kind === 'delivered') return t(keys.tracking.status.DELIVERED)
  if (etaDisplay.kind === 'unavailable') return t(keys.shipmentView.operational.chips.etaMissing)
  return formatDateForLocale(etaDisplay.value)
}

export function toDashboardAdditionalIncidentsTooltipLine(
  activeIncidentCount: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string | null {
  const additionalIncidentCount = Math.max(0, activeIncidentCount - 1)
  if (additionalIncidentCount === 0) return null
  return t(keys.dashboard.table.alertTooltip.additionalAlerts, {
    count: additionalIncidentCount,
  })
}
