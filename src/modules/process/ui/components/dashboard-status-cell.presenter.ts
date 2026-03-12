import { toProcessStatusBadgesDisplay } from '~/modules/process/ui/components/process-status-badges.presenter'
import type { ProcessStatusCode } from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import type { ProcessStatusMicrobadgeVM } from '~/modules/process/ui/viewmodels/process-status-microbadge.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

type TranslationFn = (key: string, options?: Record<string, unknown>) => string

type ProcessStatusSource = {
  readonly status: StatusVariant
  readonly statusCode: ProcessStatusCode
  readonly statusMicrobadge: ProcessStatusMicrobadgeVM | null
}

type DashboardStatusSubtitleDisplay = {
  readonly label: string
  readonly textClass: string
}

type DashboardStatusCellDisplay = {
  readonly primary: {
    readonly label: string
    readonly variant: StatusVariant
  }
  readonly subtitle: DashboardStatusSubtitleDisplay | null
}

function toSubtitleTextClass(variant: StatusVariant): string {
  if (variant === 'amber-500' || variant === 'amber-600' || variant === 'amber-700') {
    return 'text-tone-warning-fg'
  }
  if (variant === 'orange-500') return 'text-tone-warning-fg'
  if (variant === 'green-600' || variant === 'emerald-600') return 'text-tone-success-fg'
  if (variant === 'blue-500' || variant === 'indigo-500') return 'text-tone-info-fg'
  return 'text-text-muted'
}

export function toDashboardStatusCellDisplay(command: {
  readonly source: ProcessStatusSource
  readonly t: TranslationFn
  readonly keys: TranslationKeys
}): DashboardStatusCellDisplay {
  const badges = toProcessStatusBadgesDisplay({
    source: command.source,
    t: command.t,
    keys: command.keys,
  })

  return {
    primary: badges.primary,
    subtitle:
      badges.microbadge === null
        ? null
        : {
            label: badges.microbadge.label,
            textClass: toSubtitleTextClass(badges.microbadge.variant),
          },
  }
}
