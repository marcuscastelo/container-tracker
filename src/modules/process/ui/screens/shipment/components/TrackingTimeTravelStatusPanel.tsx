import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import {
  deriveCurrentLocationFromTimeline,
  deriveCurrentVesselFromTimeline,
  shouldHideCurrentVesselForCompletedLeg,
} from '~/modules/process/ui/utils/current-tracking-context'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'
import { StatusBadge } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type Props = {
  readonly containerNumber: string | null
  readonly selectedSync: TrackingTimeTravelSyncVM | null
}

function StatusField(props: { readonly label: string; readonly value: JSX.Element }): JSX.Element {
  return (
    <div class="space-y-0.5">
      <p class="text-xs-ui font-medium text-text-muted">{props.label}</p>
      <div class="text-sm-ui font-semibold text-foreground">{props.value}</div>
    </div>
  )
}

export function TrackingTimeTravelStatusPanel(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const currentVessel = createMemo(() =>
    deriveCurrentVesselFromTimeline(props.selectedSync?.timeline ?? []),
  )
  const currentLocation = createMemo(() =>
    deriveCurrentLocationFromTimeline(props.selectedSync?.timeline ?? []),
  )
  const hideCurrentVessel = createMemo(() =>
    shouldHideCurrentVesselForCompletedLeg(props.selectedSync?.timeline ?? []),
  )

  return (
    <Panel
      title={t(keys.shipmentView.timeTravel.statusTitle)}
      class="rounded-xl"
      bodyClass="px-5 py-4"
    >
      <Show
        when={props.selectedSync}
        fallback={
          <p class="py-3 text-center text-xs-ui text-text-muted">
            {t(keys.shipmentView.timeTravel.empty)}
          </p>
        }
      >
        {(sync) => (
          <div class="space-y-4">
            <div class="flex items-center gap-2 border-b border-border/70 pb-3">
              <span class="text-sm-ui font-semibold tracking-wide text-foreground">
                {props.containerNumber ?? t(keys.shipmentView.currentStatus.unknown)}
              </span>
              <StatusBadge
                variant={sync().statusVariant}
                label={t(trackingStatusToLabelKey(keys, sync().statusCode))}
              />
            </div>

            <StatusField
              label={t(keys.shipmentView.currentStatus.eta)}
              value={
                <Show
                  when={sync().eta}
                  fallback={
                    <span class="font-medium text-text-muted">
                      {t(keys.shipmentView.currentStatus.unknown)}
                    </span>
                  }
                >
                  {(eta) => <span class="tabular-nums">{eta().date}</span>}
                </Show>
              }
            />

            <StatusField
              label={t(keys.shipmentView.currentStatus.currentLocation)}
              value={<span>{currentLocation() ?? t(keys.shipmentView.currentStatus.unknown)}</span>}
            />

            <StatusField
              label={t(keys.shipmentView.currentStatus.currentVessel)}
              value={
                <span>
                  {hideCurrentVessel()
                    ? t(keys.shipmentView.currentStatus.vesselNotApplicable)
                    : (currentVessel() ?? t(keys.shipmentView.currentStatus.unknown))}
                </span>
              }
            />

            <StatusField
              label={t(keys.shipmentView.timeTravel.syncAt)}
              value={<span>{formatDateForLocale(sync().fetchedAtIso, locale())}</span>}
            />
          </div>
        )}
      </Show>
    </Panel>
  )
}
