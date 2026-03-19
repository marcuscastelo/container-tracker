import { formatDateForLocale } from '~/shared/utils/formatDate'

export function formatTrackingTimeTravelSyncLabel(fetchedAtIso: string, locale: string): string {
  return formatDateForLocale(fetchedAtIso, locale)
}
