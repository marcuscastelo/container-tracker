import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { TrackingTimelinePanelContent } from '~/modules/process/ui/components/TimelinePanel'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  type TimelineTextExportSource,
  toHistoricalTimelineTextExportSource,
} from '~/modules/process/ui/screens/shipment/lib/serializeTimelineToText'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type TrackingTimeTravelTimelinePanelProps = {
  readonly containerNumber: string | null
  readonly carrier?: string | null
  readonly referenceNowIso: string | null
  readonly selectedSync: TrackingTimeTravelSyncVM | null
}

export function TrackingTimeTravelTimelinePanel(
  props: TrackingTimeTravelTimelinePanelProps,
): JSX.Element {
  const { t, keys } = useTranslation()
  const exportSource = createMemo<TimelineTextExportSource | null>(() => {
    if (props.selectedSync === null) {
      return null
    }

    return toHistoricalTimelineTextExportSource({
      title: t(keys.shipmentView.timeline.title),
      containerNumber: props.containerNumber,
      statusLabel: t(trackingStatusToLabelKey(keys, props.selectedSync.statusCode)),
      sync: props.selectedSync,
      referenceNowIso: props.referenceNowIso,
    })
  })

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
            currentContext: selectedSync().currentContext,
            transshipment: selectedSync().transshipment,
          }}
          containerId={null}
          timeline={selectedSync().timeline}
          exportSource={exportSource()}
          {...(props.carrier === undefined ? {} : { carrier: props.carrier })}
        />
      )}
    </Show>
  )
}
