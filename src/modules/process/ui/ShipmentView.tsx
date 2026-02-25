import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, onCleanup, Show } from 'solid-js'
import { z } from 'zod/v4'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/process/ui/components/ContainersPanel'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import { ShipmentHeader } from '~/modules/process/ui/components/ShipmentHeader'
import { TimelinePanel } from '~/modules/process/ui/components/TimelinePanel'
import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import { pollRefreshSyncStatus } from '~/modules/process/ui/utils/refresh-sync-polling'
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
type RefreshRetryState = { readonly current: number; readonly total: number }

const REFRESH_SYNC_MAX_RETRIES = 5
const REFRESH_SYNC_INITIAL_DELAY_MS = 5000

const RefreshPostResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
  syncRequestId: z.string().uuid(),
  queued: z.literal(true),
  deduped: z.boolean(),
})

const RefreshStatusResponseSchema = z.object({
  ok: z.literal(true),
  allTerminal: z.boolean(),
  requests: z.array(
    z.object({
      syncRequestId: z.string().uuid(),
      status: z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED', 'NOT_FOUND']),
      lastError: z.string().nullable(),
      updatedAt: z.string().nullable(),
      refValue: z.string().nullable(),
    }),
  ),
})

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
  readonly setRefreshRetry: (value: RefreshRetryState | null) => void
  readonly refetch: (info?: unknown) => unknown | Promise<unknown>
  readonly isDisposed: () => boolean
  readonly toTimeoutMessage: (totalRetries: number) => string
  readonly toFailedMessage: (failedCount: number, firstError: string) => string
}

function readErrorFromJsonBody(body: unknown): string | null {
  const parsed = z
    .object({
      error: z.string().optional(),
    })
    .safeParse(body)

  if (!parsed.success) {
    return null
  }

  const maybeError = parsed.data.error
  if (typeof maybeError === 'string' && maybeError.trim().length > 0) {
    return maybeError
  }

  return null
}

function toReadableErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)

  const nestedMessage = message.match(/"message"\s*:\s*"([^"]+)"/)
  if (nestedMessage?.[1]) {
    return nestedMessage[1]
  }

  const afterStatus = message.replace(/^.*?:\s*\d{3}\s*/, '')
  if (afterStatus && afterStatus.length > 0 && afterStatus.length < message.length) {
    return afterStatus.trim()
  }

  return message
}

async function enqueueContainerRefresh(
  containerNumber: string,
  carrier: string | null | undefined,
): Promise<{ readonly syncRequestId: string }> {
  const response = await fetch('/api/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ container: containerNumber, carrier: carrier ?? null }),
  })

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage = readErrorFromJsonBody(body) ?? response.statusText
    throw new Error(`refresh failed for ${containerNumber}: ${response.status} ${errorMessage}`)
  }

  const parsed = RefreshPostResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`refresh failed for ${containerNumber}: invalid enqueue response`)
  }

  return { syncRequestId: parsed.data.syncRequestId }
}

async function fetchRefreshSyncStatuses(syncRequestIds: readonly string[]) {
  const params = new URLSearchParams()
  for (const syncRequestId of syncRequestIds) {
    params.append('sync_request_id', syncRequestId)
  }

  const response = await fetch(`/api/refresh/status?${params.toString()}`)
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage = readErrorFromJsonBody(body) ?? response.statusText
    throw new Error(`refresh status failed: ${response.status} ${errorMessage}`)
  }

  const parsed = RefreshStatusResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error('refresh status failed: invalid response payload')
  }

  return parsed.data
}

async function refreshShipmentContainers(params: RefreshContainersParams): Promise<void> {
  const data = params.data
  if (!data) return

  const containers = data.containers
  if (containers.length === 0) return

  try {
    if (params.isDisposed()) return

    params.setRefreshError(null)
    params.setRefreshRetry(null)
    params.setIsRefreshing(true)

    const enqueueResults = await Promise.allSettled(
      containers.map((container) => enqueueContainerRefresh(container.number, data.carrier)),
    )

    const syncRequestIds: string[] = []
    const enqueueErrors: string[] = []

    for (const result of enqueueResults) {
      if (result.status === 'fulfilled') {
        syncRequestIds.push(result.value.syncRequestId)
      } else {
        enqueueErrors.push(toReadableErrorMessage(result.reason))
      }
    }

    const uniqueSyncRequestIds = Array.from(new Set(syncRequestIds))

    if (uniqueSyncRequestIds.length === 0) {
      const firstError = enqueueErrors[0] ?? 'Refresh failed'
      params.setRefreshError(params.toFailedMessage(enqueueErrors.length || 1, firstError))
      return
    }

    const pollingResult = await pollRefreshSyncStatus({
      syncRequestIds: uniqueSyncRequestIds,
      maxRetries: REFRESH_SYNC_MAX_RETRIES,
      initialDelayMs: REFRESH_SYNC_INITIAL_DELAY_MS,
      fetchSyncStatus: fetchRefreshSyncStatuses,
      onRetryStart(progress) {
        if (!params.isDisposed()) {
          params.setRefreshRetry(progress)
        }
      },
      shouldStop: params.isDisposed,
    })

    if (pollingResult.kind === 'cancelled') {
      return
    }

    if (pollingResult.kind === 'timeout') {
      params.setRefreshError(params.toTimeoutMessage(REFRESH_SYNC_MAX_RETRIES))
      return
    }

    const failedStatuses = pollingResult.response.requests.filter((requestStatus) => {
      return requestStatus.status === 'FAILED' || requestStatus.status === 'NOT_FOUND'
    })

    const statusErrors = failedStatuses.map((requestStatus) => {
      return requestStatus.lastError ?? `sync_request_${requestStatus.syncRequestId}_failed`
    })

    const allErrors = [...enqueueErrors, ...statusErrors]
    if (allErrors.length > 0) {
      params.setRefreshError(params.toFailedMessage(allErrors.length, allErrors[0]))
      return
    }

    params.setRefreshError(null)
  } catch (err) {
    try {
      const readableMessage = toReadableErrorMessage(err)

      console.error('Failed to refresh containers (readable):', {
        original: err,
        message: readableMessage,
      })
      if (!params.isDisposed()) {
        params.setRefreshError(readableMessage || 'Refresh failed')
      }
    } catch (loggingErr) {
      console.error('Failed to refresh containers (fallback):', err, loggingErr)
      if (!params.isDisposed()) {
        params.setRefreshError('Refresh failed')
      }
    }
  } finally {
    const disposed = params.isDisposed()

    if (!disposed) {
      params.setIsRefreshing(false)
      params.setRefreshRetry(null)
    }

    if (!disposed) {
      try {
        await Promise.resolve(params.refetch())
      } catch (err) {
        console.error('Failed to refetch after refresh:', err)
      }
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
  readonly refreshRetry: RefreshRetryState | null
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
                refreshRetry={props.refreshRetry}
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
  const { locale, t, keys } = useTranslation()

  const [shipment, { refetch }] = createResource(
    () => [props.params.id, locale()] as const,
    ([id, currentLocale]) => fetchProcess(id, currentLocale),
  )

  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const [refreshRetry, setRefreshRetry] = createSignal<RefreshRetryState | null>(null)
  const [refreshError, setRefreshError] = createSignal<string | null>(null)
  let disposed = false

  onCleanup(() => {
    disposed = true
  })

  const triggerRefresh = async () => {
    await refreshShipmentContainers({
      data: shipment(),
      setIsRefreshing,
      setRefreshError,
      setRefreshRetry,
      refetch,
      isDisposed: () => disposed,
      toTimeoutMessage(totalRetries) {
        return t(keys.shipmentView.refreshSyncTimeout, { total: totalRetries })
      },
      toFailedMessage(failedCount, firstError) {
        return t(keys.shipmentView.refreshSyncFailed, { failedCount, firstError })
      },
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
      refreshRetry={refreshRetry()}
      onTriggerRefresh={triggerRefresh}
      selectedContainerId={selectedContainerId()}
      onSelectContainer={setSelectedContainerId}
      selectedContainer={selectedContainer()}
      onOpenEditForShipment={openEditForShipment}
      onOpenCreateProcess={() => setIsCreateDialogOpen(true)}
    />
  )
}
