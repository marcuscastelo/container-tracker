import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import type { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

export function toDashboardEtaCellLabel(
  etaDisplay: ProcessSummaryVM['etaDisplay'],
  t: (key: string, opts?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (etaDisplay.kind === 'delivered') return t(keys.tracking.status.DELIVERED)
  if (etaDisplay.kind === 'unavailable') return t(keys.shipmentView.operational.chips.etaMissing)
  return formatDateForLocale(etaDisplay.value)
}
