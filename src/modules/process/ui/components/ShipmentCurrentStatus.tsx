import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { toContainerSyncLabel } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  readonly selectedContainer: ContainerDetailVM | null
  readonly syncNow: Date
}

function deriveCurrentVessel(container: ContainerDetailVM | null): string | null {
  if (!container) return null
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

function deriveCurrentLocation(container: ContainerDetailVM | null): string | null {
  if (!container) return null
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
  // Each row is a responsive grid: single column on xs (label above value),
  // two columns on sm+ (label + value) with a horizontal gap for clear separation.
  return (
    <div class="grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-4 items-start">
      <dt class="whitespace-nowrap text-micro font-medium uppercase tracking-wider text-slate-400 sm:w-40 sm:flex-shrink-0">
        {props.label}
      </dt>
      <dd class="text-sm-ui text-slate-700">{props.children}</dd>
    </div>
  )
}

export function ShipmentCurrentStatus(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()

  const currentVessel = createMemo(() => deriveCurrentVessel(props.selectedContainer))
  const currentLocation = createMemo(() => deriveCurrentLocation(props.selectedContainer))
  const unknown = () => t(keys.shipmentView.currentStatus.unknown)

  const syncLabel = createMemo(() => {
    const container = props.selectedContainer
    if (!container) return null
    return toContainerSyncLabel(
      container.sync,
      {
        syncing: t(keys.shipmentView.sync.syncing),
        never: t(keys.shipmentView.sync.never),
        updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
        failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
        updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
        failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
      },
      { now: props.syncNow, locale: locale() },
    )
  })

  return (
    <Panel title={t(keys.shipmentView.currentStatus.title)}>
      <Show
        when={props.selectedContainer}
        fallback={
          <p class="px-2.5 py-3 text-center text-xs-ui text-slate-400">
            {t(keys.shipmentView.currentStatus.noContainer)}
          </p>
        }
      >
        {(container) => (
          <div class="flex flex-col gap-2 px-2.5 py-2">
            <dl class="flex flex-col gap-2">
              {/* Container identity */}
              <StatusRow label={t(keys.shipmentView.currentStatus.container)}>
                <span class="font-semibold tracking-wide text-slate-800 break-words">
                  {container().number}
                </span>
              </StatusRow>

              {/* Status */}
              <StatusRow label={t(keys.shipmentView.currentStatus.status)}>
                <div class="flex items-start">
                  <StatusBadge
                    variant={container().status}
                    label={t(trackingStatusToLabelKey(keys, container().statusCode))}
                  />
                </div>
              </StatusRow>

              {/* Current vessel */}
              <StatusRow label={t(keys.shipmentView.currentStatus.currentVessel)}>
                <span class="font-medium break-words">{currentVessel() ?? unknown()}</span>
              </StatusRow>

              {/* Current location */}
              <StatusRow label={t(keys.shipmentView.currentStatus.currentLocation)}>
                <span class="break-words">{currentLocation() ?? unknown()}</span>
              </StatusRow>

              {/* ETA */}
              <StatusRow label={t(keys.shipmentView.currentStatus.eta)}>
                <span class="font-bold tabular-nums">
                  {container().etaChipVm.date ?? container().eta ?? unknown()}
                </span>
              </StatusRow>

              {/* Last update */}
              <StatusRow label={t(keys.shipmentView.currentStatus.lastUpdate)}>
                <span class="text-slate-500">{syncLabel() ?? unknown()}</span>
              </StatusRow>
            </dl>
          </div>
        )}
      </Show>
    </Panel>
  )
}
