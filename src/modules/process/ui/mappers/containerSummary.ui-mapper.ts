import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
import type { ContainerSummaryRowVM } from '~/modules/process/ui/viewmodels/containerSummary.vm'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'

type ContainerSummaryMapperCommand = {
  readonly containers: readonly ContainerDetailVM[]
  readonly now: Date
  readonly locale: string
  readonly t: (key: string, params?: Record<string, unknown>) => string
  readonly keys: TranslationKeys
  readonly noEtaLabel: string
  readonly updatedLabel: (relative: string) => string
}

export function toContainerSummaryRowVMs(
  command: ContainerSummaryMapperCommand,
): readonly ContainerSummaryRowVM[] {
  return command.containers.map((container) => toContainerSummaryRowVM(container, command))
}

function toContainerSummaryRowVM(
  container: ContainerDetailVM,
  command: ContainerSummaryMapperCommand,
): ContainerSummaryRowVM {
  const etaLabel = toContainerEtaChipLabel(container.etaChipVm, {
    arrived: command.t(command.keys.shipmentView.operational.chips.etaArrived),
    expectedPrefix: command.t(command.keys.shipmentView.operational.chips.etaExpected),
    delayed: command.t(command.keys.shipmentView.operational.chips.etaDelayedSuffix),
    missing: command.noEtaLabel,
  })

  const relativeTimeAt = container.sync.relativeTimeAt
  const updatedAgoLabel =
    relativeTimeAt !== null
      ? command.updatedLabel(formatRelativeTime(relativeTimeAt, command.now, command.locale))
      : null

  return {
    containerNumber: container.number,
    statusVariant: container.status,
    statusLabel: command.t(trackingStatusToLabelKey(command.keys, container.statusCode)),
    etaLabel,
    updatedAgoLabel,
    // Per-container alert count is not available in the current data model.
    // Alerts are process-level. This can be enhanced when the API exposes per-container alerts.
    alertCount: 0,
  }
}
