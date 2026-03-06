import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ContainerSummaryRowVM = {
  readonly containerNumber: string
  readonly statusVariant: StatusVariant
  readonly statusLabel: string
  readonly etaLabel: string
  readonly updatedAgoLabel: string | null
  readonly alertCount: number
}
