import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { AlertActionBanner } from '~/modules/process/ui/components/AlertActionBanner'
import { CreateProcessDialogs } from '~/modules/process/ui/components/CreateProcessDialogs'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import { RefreshErrorBanner } from '~/modules/process/ui/components/RefreshErrorBanner'
import { ShipmentDataView } from '~/modules/process/ui/components/ShipmentDataView'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type {
  ContainerEtaDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

type ExistingProcessErrorInfo = {
  readonly processId?: string
  readonly containerId?: string
  readonly containerNumber?: string
  readonly link?: string
}

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
  readonly createErrorExisting: ExistingProcessErrorInfo | undefined
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

export function ShipmentViewLayout(props: ShipmentViewLayoutProps): JSX.Element {
  const { t, keys } = useTranslation()
  const shouldShowNotFound = () =>
    Boolean(props.shipmentError) || (props.shipmentData === null && !props.shipmentLoading)

  return (
    <div class="relative min-h-screen bg-slate-50">
      {/* Wallpaper watermark — decorative only, does not affect layout */}
      <img
        src={BRANDING.wallpaper}
        alt=""
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 z-0 h-full w-full select-none object-cover opacity-[0.04]"
      />
      <div class="relative z-10">
        <AppHeader
          onCreateProcess={props.onOpenCreateProcess}
          alertCount={props.activeAlerts.length}
        />

        <Show when={props.refreshError}>
          <RefreshErrorBanner
            message={props.refreshError ?? ''}
            onDismiss={props.onDismissRefreshError}
          />
        </Show>

        <Show when={props.alertActionError}>
          <AlertActionBanner
            message={props.alertActionError ?? ''}
            onDismiss={props.onDismissAlertActionError}
          />
        </Show>

        <CreateProcessDialogs
          openEdit={props.isEditOpen}
          onCloseEdit={props.onCloseEdit}
          initialData={props.editInitialData}
          onEditSubmit={props.onEditSubmit}
          openCreate={props.isCreateDialogOpen}
          onCloseCreate={props.onCloseCreate}
          onCreateSubmit={props.onCreateSubmit}
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
    </div>
  )
}
