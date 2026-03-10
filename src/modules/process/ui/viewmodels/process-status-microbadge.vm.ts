import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'

export type ProcessStatusMicrobadgeVM = {
  readonly statusCode: ProcessStatusCode
  readonly count: number
}
