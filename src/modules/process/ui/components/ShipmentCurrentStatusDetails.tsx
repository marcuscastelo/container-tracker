import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { toContainerSyncLabel } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  deriveCurrentLocationFromTimeline,
  deriveCurrentVesselFromTimeline,
  shouldHideCurrentVesselForCompletedLeg,
} from '~/modules/process/ui/utils/current-tracking-context'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  readonly container: ContainerDetailVM
  readonly syncNow: Date
}

function StatusRow(props: { readonly label: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="grid grid-cols-1 gap-y-0.5 sm:grid-cols-2 sm:gap-x-4 items-baseline">
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
  const vesselNotApplicable = () => t(keys.shipmentView.currentStatus.vesselNotApplicable)

  const currentVessel = createMemo(() => deriveCurrentVesselFromTimeline(props.container.timeline))
  const currentLocation = createMemo(() =>
    deriveCurrentLocationFromTimeline(props.container.timeline),
  )
  const hideCurrentVessel = createMemo(() =>
    shouldHideCurrentVesselForCompletedLeg(props.container.timeline),
  )

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
    <div class="flex flex-col gap-0 px-2.5 py-2">
      {/* Container identity + status — top anchor */}
      <div class="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
        <span class="text-sm-ui font-bold tracking-wide text-slate-800">
          {props.container.number}
        </span>
        <StatusBadge
          variant={props.container.status}
          label={t(trackingStatusToLabelKey(keys, props.container.statusCode))}
        />
      </div>
      <dl class="flex flex-col gap-1.5">
        <StatusRow label={t(keys.shipmentView.currentStatus.eta)}>
          <Show
            when={props.container.etaChipVm.date}
            fallback={<span class="text-sm-ui font-medium text-slate-400 italic">{unknown()}</span>}
          >
            {(date) => (
              <span class="text-sm-ui font-bold tabular-nums text-slate-800">{date()}</span>
            )}
          </Show>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.currentLocation)}>
          <span class="font-medium text-slate-700 break-words">
            {currentLocation() ?? unknown()}
          </span>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.currentVessel)}>
          <span class="text-slate-600 break-words">
            {hideCurrentVessel() ? vesselNotApplicable() : (currentVessel() ?? unknown())}
          </span>
        </StatusRow>

        <StatusRow label={t(keys.shipmentView.currentStatus.lastUpdate)}>
          <span class="text-slate-400 text-micro">{syncLabel() ?? unknown()}</span>
        </StatusRow>
      </dl>
    </div>
  )
}
