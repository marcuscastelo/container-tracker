import { createMemo, type JSX } from 'solid-js'
import { ContainerSelector } from '~/modules/process/ui/components/ContainerSelector'
import { TrackingReviewIssuesPanel } from '~/modules/process/ui/components/TrackingReviewIssuesPanel'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
  trackingValidationMode: 'current' | 'historical'
}

export function ContainersPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const selectedContainer = createMemo(
    () => props.containers.find((container) => container.id === props.selectedId) ?? null,
  )

  return (
    <Panel
      title={`${t(keys.shipmentView.containers.title)} (${props.containers.length})`}
      class="rounded-xl"
    >
      <ContainerSelector
        containers={props.containers}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
      <TrackingReviewIssuesPanel
        trackingValidation={
          selectedContainer()?.trackingValidation ?? {
            hasIssues: false,
            highestSeverity: null,
            findingCount: 0,
            activeIssues: [],
          }
        }
        containerNumber={selectedContainer()?.number ?? null}
        mode={props.trackingValidationMode}
      />
    </Panel>
  )
}
