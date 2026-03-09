import type { JSX } from 'solid-js'
import { ErrorBoundary } from 'solid-js'
import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/process/ui/components/ContainersPanel'
import { OperationalSummaryStrip } from '~/modules/process/ui/components/OperationalSummaryStrip'
import { ShipmentHeader } from '~/modules/process/ui/components/ShipmentHeader'
import { ShipmentInfoCard } from '~/modules/process/ui/components/ShipmentInfoCard'
import { TimelinePanel } from '~/modules/process/ui/components/TimelinePanel'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'

type ShipmentDataViewProps = {
  readonly data: ShipmentDetailVM
  readonly activeAlerts: readonly AlertDisplayVM[]
  readonly archivedAlerts: readonly AlertDisplayVM[]
  readonly busyAlertIds: ReadonlySet<string>
  readonly collapsingAlertIds: ReadonlySet<string>
  readonly onAcknowledgeAlert: (alertId: string) => void
  readonly onUnacknowledgeAlert: (alertId: string) => void
  readonly onOpenEdit: (focus?: 'reference' | 'carrier' | null | undefined) => void
  readonly isRefreshing: boolean
  readonly refreshRetry: { readonly current: number; readonly total: number } | null
  readonly refreshHint: string | null
  readonly syncNow: Date
  readonly onTriggerRefresh: () => void
  readonly selectedContainerId: string
  readonly onSelectContainer: (containerId: string) => void
  readonly selectedContainer: ShipmentDetailVM['containers'][number] | null
}

export function ShipmentDataView(props: ShipmentDataViewProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <>
      <ShipmentHeader
        data={props.data}
        syncNow={props.syncNow}
        isRefreshing={props.isRefreshing}
        refreshRetry={props.refreshRetry}
        refreshHint={props.refreshHint}
        activeAlertCount={props.activeAlerts.length}
        onTriggerRefresh={props.onTriggerRefresh}
        onOpenEdit={props.onOpenEdit}
      />

      <OperationalSummaryStrip data={props.data} alerts={props.activeAlerts} />

      <div class="grid gap-2 lg:grid-cols-3">
        <div class="space-y-3 lg:col-span-2">
          <div class=" ">
            <ErrorBoundary
              fallback={(err) => {
                console.error('Alerts panel render failure:', err)
                return (
                  <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs-ui text-amber-800">
                    {t(keys.app.unexpectedRenderError)}
                  </div>
                )
              }}
            >
              <AlertsPanel
                activeAlerts={props.activeAlerts}
                archivedAlerts={props.archivedAlerts}
                busyAlertIds={props.busyAlertIds}
                collapsingAlertIds={props.collapsingAlertIds}
                onAcknowledge={props.onAcknowledgeAlert}
                onUnacknowledge={props.onUnacknowledgeAlert}
              />
            </ErrorBoundary>
          </div>
          <section id="shipment-containers" class="scroll-mt-[120px]">
            <ContainersPanel
              containers={props.data.containers}
              selectedId={props.selectedContainerId}
              onSelect={props.onSelectContainer}
              syncNow={props.syncNow}
            />
          </section>
          <section id="shipment-timeline" class="scroll-mt-[120px]">
            <ErrorBoundary
              fallback={(err) => {
                console.error('Timeline panel render failure:', err)
                return (
                  <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs-ui text-red-700">
                    {t(keys.app.unexpectedRenderError)}
                  </div>
                )
              }}
            >
              <TimelinePanel
                selectedContainer={props.selectedContainer}
                carrier={props.data.carrier}
                alerts={props.activeAlerts}
              />
            </ErrorBoundary>
          </section>
        </div>
        <div class="space-y-2">
          <ShipmentInfoCard data={props.data} />
        </div>
      </div>
    </>
  )
}
