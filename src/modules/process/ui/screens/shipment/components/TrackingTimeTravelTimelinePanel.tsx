import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { TrackingTimelinePanelContent } from '~/modules/process/ui/components/TimelinePanel'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type TrackingTimeTravelTimelinePanelProps = {
  readonly containerNumber: string | null
  readonly carrier?: string | null
  readonly selectedSync: TrackingTimeTravelSyncVM | null
}

export function TrackingTimeTravelTimelinePanel(
  props: TrackingTimeTravelTimelinePanelProps,
): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Show
      when={props.selectedSync}
      fallback={
        <Panel title={t(keys.shipmentView.timeline.title)} class="rounded-xl" bodyClass="px-3 py-3">
          <p class="py-3 text-center text-xs-ui text-text-muted">
            {t(keys.shipmentView.timeTravel.empty)}
          </p>
        </Panel>
      }
    >
      {(selectedSync) => (
        <TrackingTimelinePanelContent
          title={t(keys.shipmentView.timeline.title)}
          container={{
            number: props.containerNumber ?? 'UNKNOWN',
            status: selectedSync().statusVariant,
            statusCode: selectedSync().statusCode,
            transshipment: {
              hasTransshipment: false,
              count: 0,
              ports: [],
            },
          }}
          containerId={null}
          timeline={selectedSync().timeline}
          alerts={selectedSync().alerts}
          {...(props.carrier === undefined ? {} : { carrier: props.carrier })}
        />
      )}
    </Show>
  )
}
