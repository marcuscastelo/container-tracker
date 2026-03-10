import {
  type ProcessStatusCode,
  processStatusToLabelKey,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import { toProcessStatusMicrobadgeDisplayVM } from '~/modules/process/ui/mappers/processStatusMicrobadge.ui-mapper'
import type { ProcessStatusMicrobadgeVM } from '~/modules/process/ui/viewmodels/process-status-microbadge.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

type TranslationFn = (key: string, options?: Record<string, unknown>) => string

type ProcessStatusBadgeSource = {
  readonly status: StatusVariant
  readonly statusCode: ProcessStatusCode
  readonly statusMicrobadge: ProcessStatusMicrobadgeVM | null
}

type ProcessStatusMicrobadgeDisplay = {
  readonly label: string
  readonly variant: StatusVariant
}

type ProcessStatusBadgesDisplay = {
  readonly primary: {
    readonly label: string
    readonly variant: StatusVariant
  }
  readonly microbadge: ProcessStatusMicrobadgeDisplay | null
}

export function toProcessStatusBadgesDisplay(command: {
  readonly source: ProcessStatusBadgeSource
  readonly t: TranslationFn
  readonly keys: TranslationKeys
}): ProcessStatusBadgesDisplay {
  return {
    primary: {
      label: command.t(processStatusToLabelKey(command.keys, command.source.statusCode)),
      variant: command.source.status,
    },
    microbadge: toProcessStatusMicrobadgeDisplayVM({
      t: command.t,
      keys: command.keys,
      microbadge: command.source.statusMicrobadge,
    }),
  }
}
