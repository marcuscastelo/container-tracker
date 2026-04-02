import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { toContainerSyncLabel } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import type { Instant } from '~/shared/time/instant'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  readonly container: ContainerDetailVM
  readonly syncNow: Instant
}

type StatusFieldProps = {
  readonly label: string
  readonly value: JSX.Element
}

function StatusField(props: StatusFieldProps): JSX.Element {
  return (
    <div class="space-y-0.5">
      <p class="text-xs-ui font-medium text-text-muted">{props.label}</p>
      <div class="text-sm-ui font-semibold text-foreground">{props.value}</div>
    </div>
  )
}

export function ShipmentCurrentStatusDetails(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const unknown = () => t(keys.shipmentView.currentStatus.unknown)
  const vesselNotApplicable = () => t(keys.shipmentView.currentStatus.vesselNotApplicable)
  const currentLocation = () =>
    props.container.currentContext.locationDisplay ?? props.container.currentContext.locationCode
  const currentVessel = () => props.container.currentContext.vesselName
  const hideCurrentVessel = () => props.container.currentContext.vesselVisible === false

  const syncLabel = createMemo(() =>
    toContainerSyncLabel(
      props.container.sync,
      {
        syncing: t(keys.shipmentView.sync.syncing),
        never: t(keys.shipmentView.sync.never),
        updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
        failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
        updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
        failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
      },
      { now: props.syncNow, locale: locale() },
    ),
  )

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2 border-b border-border/70 pb-3">
        <span class="text-sm-ui font-semibold tracking-wide text-foreground">
          {props.container.number}
        </span>
        <StatusBadge
          variant={props.container.status}
          label={t(trackingStatusToLabelKey(keys, props.container.statusCode))}
        />
      </div>

      <StatusField
        label={t(keys.shipmentView.currentStatus.eta)}
        value={
          <Show
            when={props.container.etaChipVm.date}
            fallback={<span class="font-medium text-text-muted">{unknown()}</span>}
          >
            {(date) => <span class="tabular-nums">{date()}</span>}
          </Show>
        }
      />

      <StatusField
        label={t(keys.shipmentView.currentStatus.currentLocation)}
        value={<span>{currentLocation() ?? unknown()}</span>}
      />

      <StatusField
        label={t(keys.shipmentView.currentStatus.currentVessel)}
        value={
          <span>
            {hideCurrentVessel() ? vesselNotApplicable() : (currentVessel() ?? unknown())}
          </span>
        }
      />

      <StatusField
        label={t(keys.shipmentView.currentStatus.lastUpdate)}
        value={<span class="font-medium text-text-muted">{syncLabel() ?? unknown()}</span>}
      />
    </div>
  )
}
