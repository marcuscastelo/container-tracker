import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { TrackingTimeTravelDiffVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly diff: TrackingTimeTravelDiffVM | null
}

export function TrackingTimeTravelDiffSummary(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const lines = () => {
    const diff = props.diff
    if (!diff) return [t(keys.shipmentView.timeTravel.empty)]
    if (diff.kind === 'initial') {
      return [t(keys.shipmentView.timeTravel.initialCheckpoint)]
    }

    const changes: string[] = []

    if (diff.statusChanged) {
      changes.push(
        t(keys.shipmentView.timeTravel.diff.statusChanged, {
          from: t(trackingStatusToLabelKey(keys, diff.previousStatusCode)),
          to: t(trackingStatusToLabelKey(keys, diff.currentStatusCode)),
        }),
      )
    }
    if (diff.timelineChanged) {
      changes.push(
        t(keys.shipmentView.timeTravel.diff.timelineChanged, {
          added: diff.addedTimelineCount,
          removed: diff.removedTimelineCount,
        }),
      )
    }
    if (diff.alertsChanged) {
      changes.push(
        t(keys.shipmentView.timeTravel.diff.alertsChanged, {
          added: diff.newAlertsCount,
          removed: diff.resolvedAlertsCount,
        }),
      )
    }
    if (diff.etaChanged) {
      changes.push(t(keys.shipmentView.timeTravel.diff.etaChanged))
    }
    if (diff.actualConflictAppeared) {
      changes.push(t(keys.shipmentView.timeTravel.diff.conflictAppeared))
    }
    if (diff.actualConflictResolved) {
      changes.push(t(keys.shipmentView.timeTravel.diff.conflictResolved))
    }

    return changes.length > 0 ? changes : [t(keys.shipmentView.timeTravel.diff.noChanges)]
  }

  return (
    <Panel
      title={t(keys.shipmentView.timeTravel.diffTitle)}
      class="rounded-xl"
      bodyClass="px-3 py-3"
    >
      <ul class="space-y-2">
        <For each={lines()}>
          {(line) => (
            <li class="rounded-md border border-border/70 bg-surface-muted/70 px-3 py-2 text-xs-ui text-foreground">
              {line}
            </li>
          )}
        </For>
      </ul>
    </Panel>
  )
}
