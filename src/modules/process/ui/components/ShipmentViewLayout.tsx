import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/process/ui/components/ContainersPanel'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import { OperationalSummaryStrip } from '~/modules/process/ui/components/OperationalSummaryStrip'
import { ShipmentHeader } from '~/modules/process/ui/components/ShipmentHeader'
import { ShipmentInfoCard } from '~/modules/process/ui/components/ShipmentInfoCard'
import { TimelinePanel } from '~/modules/process/ui/components/TimelinePanel'
import type { ExistingProcessConflict } from '~/modules/process/ui/validation/processConflict.validation'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type {
  ContainerEtaDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

export type ShipmentViewLayoutProps = {
  readonly refreshError: string | null
  readonly alertActionError: string | null
  readonly refreshHint: string | null
  readonly onDismissRefreshError: () => void
  readonly onDismissAlertActionError: () => void
  readonly isEditOpen: boolean
  readonly onCloseEdit: () => void
  readonly editInitialData: CreateProcessDialogFormData | null
  readonly focusFieldOnOpen: 'reference' | 'carrier' | null
  readonly onEditSubmit: (formData: CreateProcessDialogFormData) => Promise<void>
  readonly isCreateDialogOpen: boolean
  readonly onCloseCreate: () => void
  readonly onCreateSubmit: (formData: CreateProcessDialogFormData) => Promise<void>
  readonly hasCreateError: boolean
  readonly createErrorMessage: string
  readonly createErrorExisting: ExistingProcessConflict | undefined
  readonly onAcknowledgeCreateError: () => void
  readonly shipmentData: ShipmentDetailVM | null | undefined
  readonly shipmentLoading: boolean
  readonly shipmentError: unknown
  readonly activeAlerts: readonly AlertDisplayVM[]
  readonly archivedAlerts: readonly AlertDisplayVM[]
  readonly busyAlertIds: ReadonlySet<string>
  readonly collapsingAlertIds: ReadonlySet<string>
  readonly isRefreshing: boolean
  readonly refreshRetry: { readonly current: number; readonly total: number } | null
  readonly syncNow: Date
  readonly onTriggerRefresh: () => void
  readonly onAcknowledgeAlert: (alertId: string) => void
  readonly onUnacknowledgeAlert: (alertId: string) => void
  readonly selectedContainerId: string
  readonly onSelectContainer: (containerId: string) => void
  readonly selectedContainer: ShipmentDetailVM['containers'][number] | null
  readonly selectedContainerEtaVm: ContainerEtaDetailVM
  readonly onOpenEditForShipment: (
    shipment: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => void
  readonly onOpenCreateProcess: () => void
}

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

function ShipmentDataView(props: ShipmentDataViewProps): JSX.Element {
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
          <div class="sticky top-0 z-50">
            <AlertsPanel
              activeAlerts={props.activeAlerts}
              archivedAlerts={props.archivedAlerts}
              busyAlertIds={props.busyAlertIds}
              collapsingAlertIds={props.collapsingAlertIds}
              onAcknowledge={props.onAcknowledgeAlert}
              onUnacknowledge={props.onUnacknowledgeAlert}
            />
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
            <TimelinePanel
              selectedContainer={props.selectedContainer}
              carrier={props.data.carrier}
              alerts={props.activeAlerts}
            />
          </section>
        </div>
        <div class="space-y-2">
          <ShipmentInfoCard data={props.data} />
        </div>
      </div>
    </>
  )
}

export function ShipmentViewLayout(props: ShipmentViewLayoutProps): JSX.Element {
  const { t, keys } = useTranslation()
  const shouldShowNotFound = () =>
    Boolean(props.shipmentError) || (props.shipmentData === null && !props.shipmentLoading)

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader
        onCreateProcess={props.onOpenCreateProcess}
        alertCount={props.activeAlerts.length}
      />

      <Show when={props.refreshError}>
        <div class="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div class="flex items-start justify-between gap-4">
              <div>{props.refreshError}</div>
              <button
                type="button"
                class="ml-4 text-red-700 underline"
                aria-label={t(keys.createProcess.action.dismissError)}
                onClick={() => props.onDismissRefreshError()}
              >
                {t(keys.createProcess.action.dismiss)}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={props.alertActionError}>
        <div class="mx-auto mt-2 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div class="flex items-start justify-between gap-4">
              <div>{props.alertActionError}</div>
              <button
                type="button"
                class="ml-4 text-amber-700 underline"
                aria-label={t(keys.shipmentView.alerts.action.dismissActionError)}
                onClick={() => props.onDismissAlertActionError()}
              >
                {t(keys.createProcess.action.dismiss)}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <CreateProcessDialog
        open={props.isEditOpen}
        onClose={props.onCloseEdit}
        initialData={props.editInitialData}
        mode="edit"
        focus={props.focusFieldOnOpen ?? undefined}
        onSubmit={props.onEditSubmit}
      />

      <CreateProcessDialog
        open={props.isCreateDialogOpen}
        onClose={props.onCloseCreate}
        onSubmit={props.onCreateSubmit}
        mode="create"
      />

      <main class="mx-auto max-w-7xl px-2 py-2 sm:px-4 lg:px-8">
        <A
          href="/"
          class="mb-1.5 inline-flex items-center gap-1 text-micro text-slate-400 hover:text-slate-700"
        >
          <ChevronLeftIcon />
          {t(keys.shipmentView.backToList)}
        </A>

        <Show when={props.hasCreateError}>
          <ExistingProcessError
            message={props.createErrorMessage}
            existing={props.createErrorExisting}
            onAcknowledge={props.onAcknowledgeCreateError}
          />
        </Show>

        <Show when={props.shipmentLoading}>
          <div class="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p class="text-slate-500">{t(keys.shipmentView.loading)}</p>
          </div>
        </Show>

        <Show when={shouldShowNotFound()}>
          <div class="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p class="text-red-500">{t(keys.shipmentView.notFound)}</p>
            <A href="/" class="mt-4 inline-block text-sm text-slate-600 hover:text-slate-900">
              {t(keys.shipmentView.backToDashboard)}
            </A>
          </div>
        </Show>

        <Show when={props.shipmentData}>
          {(data) => (
            <ShipmentDataView
              data={data()}
              activeAlerts={props.activeAlerts}
              archivedAlerts={props.archivedAlerts}
              busyAlertIds={props.busyAlertIds}
              collapsingAlertIds={props.collapsingAlertIds}
              onAcknowledgeAlert={props.onAcknowledgeAlert}
              onUnacknowledgeAlert={props.onUnacknowledgeAlert}
              isRefreshing={props.isRefreshing}
              refreshRetry={props.refreshRetry}
              refreshHint={props.refreshHint}
              syncNow={props.syncNow}
              onTriggerRefresh={props.onTriggerRefresh}
              onOpenEdit={(focus?: 'reference' | 'carrier' | null | undefined) =>
                props.onOpenEditForShipment(data(), focus)
              }
              selectedContainerId={props.selectedContainerId}
              onSelectContainer={props.onSelectContainer}
              selectedContainer={props.selectedContainer}
            />
          )}
        </Show>
      </main>
    </div>
  )
}
