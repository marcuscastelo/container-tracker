import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/process/ui/components/ContainersPanel'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import { ShipmentHeader } from '~/modules/process/ui/components/ShipmentHeader'
import { TimelinePanel } from '~/modules/process/ui/components/TimelinePanel'
import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import {
  createProcessRequest,
  toCreateProcessInput,
  updateProcessRequest,
} from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

type DialogCarrier = CreateProcessDialogFormData['carrier']
type ShipmentContainer = ShipmentDetailVM['containers'][number]

const DIALOG_CARRIERS: readonly DialogCarrier[] = [
  'maersk',
  'msc',
  'cmacgm',
  'hapag',
  'one',
  'evergreen',
  'unknown',
]

function isDialogCarrier(value: string): value is DialogCarrier {
  return DIALOG_CARRIERS.some((carrier) => carrier === value)
}

function toDialogCarrier(value: string | null | undefined): DialogCarrier {
  if (!value) return 'unknown'
  return isDialogCarrier(value) ? value : 'unknown'
}

type RefreshContainersParams = {
  readonly data: ShipmentDetailVM | null | undefined
  readonly setIsRefreshing: (value: boolean) => void
  readonly setRefreshError: (value: string | null) => void
  readonly refetch: (info?: unknown) => unknown | Promise<unknown>
}

async function refreshShipmentContainers(params: RefreshContainersParams): Promise<void> {
  const data = params.data
  if (!data) return

  const containers = data.containers
  if (containers.length === 0) return

  try {
    params.setIsRefreshing(true)

    const promises = containers.map((container) =>
      fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container: container.number, carrier: data.carrier ?? null }),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`refresh failed for ${container.number}: ${res.status} ${text}`)
        }
        return res.json().catch(() => ({}))
      }),
    )

    await Promise.all(promises)
  } catch (err) {
    try {
      const message = err instanceof Error ? err.message : String(err)
      let readableMessage = message
      const nestedMessage = message.match(/"message"\s*:\s*"([^"]+)"/)
      if (nestedMessage?.[1]) {
        readableMessage = nestedMessage[1]
      } else {
        const afterStatus = message.replace(/^.*?:\s*\d{3}\s*/, '')
        if (afterStatus && afterStatus.length > 0 && afterStatus.length < message.length) {
          readableMessage = afterStatus.trim()
        }
      }

      console.error('Failed to refresh containers (readable):', {
        original: err,
        message: readableMessage,
      })
      params.setRefreshError(readableMessage || 'Refresh failed')
    } catch (loggingErr) {
      console.error('Failed to refresh containers (fallback):', err, loggingErr)
      params.setRefreshError('Refresh failed')
    }
  } finally {
    params.setIsRefreshing(false)
    try {
      await Promise.resolve(params.refetch())
    } catch (err) {
      console.error('Failed to refetch after refresh:', err)
    }
  }
}

type ShipmentViewLayoutProps = {
  readonly refreshError: string | null
  readonly onDismissRefreshError: () => void
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
  readonly isRefreshing: boolean
  readonly onTriggerRefresh: () => void
  readonly selectedContainerId: string
  readonly onSelectContainer: (containerId: string) => void
  readonly selectedContainer: ShipmentContainer | null
  readonly onOpenEditForShipment: (
    shipment: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => void
  readonly onOpenCreateProcess: () => void
}

function ShipmentViewLayout(props: ShipmentViewLayoutProps): JSX.Element {
  const { t, keys } = useTranslation()
  const shouldShowNotFound = () =>
    Boolean(props.shipmentError) || (props.shipmentData === null && !props.shipmentLoading)

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader onCreateProcess={props.onOpenCreateProcess} />

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

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <A
          href="/"
          class="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
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
            <>
              <ShipmentHeader
                data={data()}
                isRefreshing={props.isRefreshing}
                onTriggerRefresh={props.onTriggerRefresh}
                onOpenEdit={(focus?: 'reference' | 'carrier' | null | undefined) =>
                  props.onOpenEditForShipment(data(), focus)
                }
              />

              <div class="grid gap-6 lg:grid-cols-3">
                <div class="space-y-6 lg:col-span-2">
                  <ContainersPanel
                    containers={data().containers}
                    selectedId={props.selectedContainerId}
                    onSelect={props.onSelectContainer}
                  />
                  <TimelinePanel
                    selectedContainer={props.selectedContainer}
                    carrier={data().carrier}
                  />
                </div>
                <div>
                  <AlertsPanel alerts={data().alerts} />
                </div>
              </div>
            </>
          )}
        </Show>
      </main>
    </div>
  )
}

function toEditInitialData(data: ShipmentDetailVM): CreateProcessDialogFormData {
  return {
    reference: data.reference ?? '',
    origin: data.origin || '',
    destination: data.destination || '',
    containers: data.containers.map((container) => ({
      id: container.id,
      containerNumber: container.number,
    })),
    carrier: toDialogCarrier(data.carrier),
    billOfLading: data.bill_of_lading ?? '',
    bookingNumber: data.booking_number ?? '',
    importerName: data.importer_name ?? '',
    exporterName: data.exporter_name ?? '',
    referenceImporter: data.reference_importer ?? '',
    product: data.product ?? '',
    redestinationNumber: data.redestination_number ?? '',
  }
}

export function ShipmentView(props: { params: { id: string } }): JSX.Element {
  const { locale } = useTranslation()

  const [shipment, { refetch }] = createResource(
    () => [props.params.id, locale()] as const,
    ([id, currentLocale]) => fetchProcess(id, currentLocale),
  )

  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const [refreshError, setRefreshError] = createSignal<string | null>(null)

  const triggerRefresh = async () => {
    await refreshShipmentContainers({
      data: shipment(),
      setIsRefreshing,
      setRefreshError,
      refetch,
    })
  }

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = createSignal(false)
  const [editInitialData, setEditInitialData] = createSignal<CreateProcessDialogFormData | null>(
    null,
  )
  // which field should receive focus when opening the edit dialog (null = none)
  const [focusFieldOnOpen, setFocusFieldOnOpen] = createSignal<'reference' | 'carrier' | null>(null)

  // Create dialog state (header "Create process" button uses this)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const navigate = useNavigate()
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

  // Copy button state is handled by shared `CopyButton` component

  const handleCreateSubmit = async (formData: CreateProcessDialogFormData) => {
    try {
      try {
        const resultId = await createProcessRequest(toCreateProcessInput(formData))
        setIsCreateDialogOpen(false)
        navigate(`/shipments/${resultId}`)
      } catch (err) {
        const conflict = parseExistingProcessConflictError(err)
        if (conflict) {
          setIsCreateDialogOpen(false)
          setCreateError(conflict)
          return
        }
        throw err
      }
    } catch (err) {
      console.error('Failed to create process:', err)
      setIsCreateDialogOpen(false)
    }
  }

  const handleEditSubmit = async (formData: CreateProcessDialogFormData) => {
    try {
      const input = toCreateProcessInput(formData)

      try {
        await updateProcessRequest(props.params.id, input)

        // Refresh data
        await refetch()
        setIsEditOpen(false)
      } catch (err) {
        const conflict = parseExistingProcessConflictError(err)
        if (conflict) {
          setIsEditOpen(false)
          setCreateError(conflict)
          return
        }
        throw err
      }
    } catch (err) {
      console.error('Failed to update process:', err)
      const conflict = parseExistingProcessConflictError(err)
      if (conflict) {
        setCreateError(conflict)
      }
      // Could show other UI error; for now just log and close
      setIsEditOpen(false)
    }
  }

  const [selectedContainerId, setSelectedContainerId] = createSignal<string>('')

  // Set the first container as selected when data loads
  const selectedContainer = createMemo(() => {
    const data = shipment()
    if (!data) return null
    const containers = data.containers
    if (containers.length === 0) return null

    const selected = selectedContainerId()
    if (selected) {
      return containers.find((c) => c.id === selected) ?? containers[0]
    }
    return containers[0]
  })

  // Update selected container when data loads
  createEffect(() => {
    const data = shipment()
    if (data && data.containers.length > 0 && !selectedContainerId()) {
      setSelectedContainerId(data.containers[0].id)
    }
  })

  const createErrorMessage = () => {
    const value = createError()
    if (typeof value === 'string') return value
    return value?.message ?? ''
  }

  const createErrorExisting = () => {
    const value = createError()
    if (typeof value === 'string') return undefined
    return value ?? undefined
  }

  const openEditForShipment = (
    shipmentData: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => {
    const initialData = toEditInitialData(shipmentData)
    setEditInitialData(initialData)

    if (focus === 'carrier') {
      setFocusFieldOnOpen('carrier')
    } else if (focus === 'reference') {
      setFocusFieldOnOpen('reference')
    } else {
      setFocusFieldOnOpen(null)
    }

    setIsEditOpen(true)
  }

  return (
    <ShipmentViewLayout
      refreshError={refreshError()}
      onDismissRefreshError={() => setRefreshError(null)}
      isEditOpen={isEditOpen()}
      onCloseEdit={() => {
        setIsEditOpen(false)
        setFocusFieldOnOpen(null)
      }}
      editInitialData={editInitialData()}
      focusFieldOnOpen={focusFieldOnOpen()}
      onEditSubmit={handleEditSubmit}
      isCreateDialogOpen={isCreateDialogOpen()}
      onCloseCreate={() => setIsCreateDialogOpen(false)}
      onCreateSubmit={handleCreateSubmit}
      hasCreateError={Boolean(createError())}
      createErrorMessage={createErrorMessage()}
      createErrorExisting={createErrorExisting()}
      onAcknowledgeCreateError={() => setCreateError(null)}
      shipmentData={shipment()}
      shipmentLoading={shipment.loading}
      shipmentError={shipment.error}
      isRefreshing={isRefreshing()}
      onTriggerRefresh={triggerRefresh}
      selectedContainerId={selectedContainerId()}
      onSelectContainer={setSelectedContainerId}
      selectedContainer={selectedContainer()}
      onOpenEditForShipment={openEditForShipment}
      onOpenCreateProcess={() => setIsCreateDialogOpen(true)}
    />
  )
}
