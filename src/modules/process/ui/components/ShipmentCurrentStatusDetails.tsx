import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import { toContainerSyncLabel } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  readonly container: ContainerDetailVM
  readonly syncNow: Date
}

function deriveCurrentVessel(container: ContainerDetailVM): string | null {
  const timeline = container.timeline
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.vesselName && event.eventTimeType === 'ACTUAL') {
      return event.vesselName
    }
  }
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.vesselName) {
      return event.vesselName
    }
  }
  return null
}

function deriveCurrentLocation(container: ContainerDetailVM): string | null {
  const timeline = container.timeline
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.location && event.eventTimeType === 'ACTUAL') {
      return event.location
    }
  }
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.location) {
      return event.location
    }
  }
  return null
}

function StatusRow(props: { readonly label: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-4 items-start">
      <dt class="whitespace-nowrap text-micro font-medium uppercase tracking-wider text-slate-400 sm:w-40 sm:flex-shrink-0">
        {props.label}
      </dt>
      <dd class="text-sm-ui text-slate-700">{props.children}</dd>
    </div>
  )
}

export function ShipmentCurrentStatusDetails(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const unknown = () => t(keys.shipmentView.currentStatus.unknown)

  const currentVessel = createMemo(() => deriveCurrentVessel(props.container))
  const currentLocation = createMemo(() => deriveCurrentLocation(props.container))

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
    <div class="flex flex-col gap-2 px-2.5 py-2">
      <dl class="flex flex-col gap-2">
        <StatusRow label={t(keys.shipmentView.currentStatus.container)}>
          <span class="font-semibold tracking-wide text-slate-800 break-words">
            {props.container.number}
          </span>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.status)}>
          <div class="flex items-start">
            <StatusBadge
              variant={props.container.status}
              label={t(trackingStatusToLabelKey(keys, props.container.statusCode))}
            />
          </div>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.currentVessel)}>
          <span class="font-medium break-words">{currentVessel() ?? unknown()}</span>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.currentLocation)}>
          <span class="break-words">{currentLocation() ?? unknown()}</span>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.eta)}>
          <span class="font-bold tabular-nums">
            {props.container.etaChipVm.date ?? props.container.eta ?? unknown()}
          </span>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.lastUpdate)}>
          <span class="text-slate-500">{syncLabel() ?? unknown()}</span>
        </StatusRow>
      </dl>
    </div>
  )
}
