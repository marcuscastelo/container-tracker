import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, onCleanup, Show } from 'solid-js'
import { z } from 'zod/v4'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'

import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import { pollRefreshSyncStatus } from '~/modules/process/ui/utils/refresh-sync-polling'
import { useSyncRealtimeCoordinator } from '~/modules/process/ui/utils/sync-realtime-coordinator'
import {
  acknowledgeTrackingAlertRequest,
  createProcessRequest,
  toCreateProcessInput,
  unacknowledgeTrackingAlertRequest,
  updateProcessRequest,
} from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type {
  ContainerEtaDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import {
  type SyncRequestRealtimeEvent,
  subscribeToSyncRequestsRealtimeByIds,
} from '~/shared/api/sync-requests.realtime.client'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

type DialogCarrier = CreateProcessDialogFormData['carrier']
type ShipmentContainer = ShipmentDetailVM['containers'][number]
type RefreshRetryState = { readonly current: number; readonly total: number }

const REFRESH_SYNC_MAX_RETRIES = 5
const REFRESH_SYNC_INITIAL_DELAY_MS = 5000
const REFRESH_SOFT_BLOCK_WINDOW_MS = 60_000

function buildRecentUpdateHint(command: {
  readonly elapsedMs: number
  readonly toSecondsLabel: (count: number) => string
  readonly toMinutesLabel: (count: number) => string
}): string {
  const elapsedSeconds = Math.max(1, Math.floor(command.elapsedMs / 1000))
  if (elapsedSeconds < 60) {
    return command.toSecondsLabel(elapsedSeconds)
  }

  const elapsedMinutes = Math.max(1, Math.floor(elapsedSeconds / 60))
  return command.toMinutesLabel(elapsedMinutes)
}

function compareAlertsByTriggeredAtDesc(left: AlertDisplayVM, right: AlertDisplayVM): number {
  const triggeredAtCompare = right.triggeredAtIso.localeCompare(left.triggeredAtIso)
  if (triggeredAtCompare !== 0) return triggeredAtCompare
  return right.id.localeCompare(left.id)
}

function compareAlertsByAckedAtDesc(left: AlertDisplayVM, right: AlertDisplayVM): number {
  const leftAckedAt = left.ackedAtIso ?? ''
  const rightAckedAt = right.ackedAtIso ?? ''
  const ackedAtCompare = rightAckedAt.localeCompare(leftAckedAt)
  if (ackedAtCompare !== 0) return ackedAtCompare
  return right.id.localeCompare(left.id)
}

function toSortedActiveAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
  return [...alerts]
    .filter((alert) => alert.ackedAtIso === null)
    .sort(compareAlertsByTriggeredAtDesc)
}

function toSortedArchivedAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
  return [...alerts].filter((alert) => alert.ackedAtIso !== null).sort(compareAlertsByAckedAtDesc)
}

function withAlertMarkedAsAcknowledged(
  alerts: readonly AlertDisplayVM[],
  alertId: string,
  ackedAtIso: string,
): readonly AlertDisplayVM[] {
  return alerts.map((alert) => {
    if (alert.id !== alertId) return alert
    return {
      ...alert,
      ackedAtIso,
    }
  })
}

function withAlertMarkedAsActive(
  alerts: readonly AlertDisplayVM[],
  alertId: string,
): readonly AlertDisplayVM[] {
  return alerts.map((alert) => {
    if (alert.id !== alertId) return alert
    return {
      ...alert,
      ackedAtIso: null,
    }
  })
}

function withSetEntry(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set)
  next.add(value)
  return next
}

function withoutSetEntry(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set)
  next.delete(value)
  return next
}

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

type RefreshStatusRequest = {
  readonly syncRequestId: string
  readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

type RefreshStatusResponse = {
  readonly ok: true
  readonly allTerminal: boolean
  readonly requests: readonly RefreshStatusRequest[]
}

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
  readonly setRefreshHint: (value: string | null) => void
  readonly setRefreshRetry: (value: RefreshRetryState | null) => void
  readonly setLastRefreshDoneAt: (value: Date | null) => void
  readonly setRealtimeCleanup: (cleanup: (() => void) | null) => void
  // This line contains a type annotation that the i18n-enforce tool may false-positive as JSX text.
  readonly refreshTrackingData: () => Promise<void> // i18n-enforce-ignore
  readonly isDisposed: () => boolean
  readonly toTimeoutMessage: (totalRetries: number) => string
  readonly toFailedMessage: (failedCount: number, firstError: string) => string
}

function toLatestDoneAtOrNow(requests: readonly RefreshStatusRequest[]): Date {
  const doneTimestamps = requests
    .map((request) => {
      if (request.status !== 'DONE' || request.updatedAt === null) {
        return Number.NaN
      }
      return Date.parse(request.updatedAt)
    })
    .filter((value) => Number.isFinite(value))

  if (doneTimestamps.length === 0) {
    return new Date()
  }

  return new Date(Math.max(...doneTimestamps))
}

async function refreshTrackingDataOnly(command: {
  readonly processId: string
  readonly locale: string
  readonly current: ShipmentDetailVM | null | undefined
  readonly apply: (next: ShipmentDetailVM) => void
}): Promise<void> {
  const latest = await fetchProcess(command.processId, command.locale)
  if (!latest) return

  if (!command.current) {
    command.apply(latest)
    return
  }

  // Keep non-tracking process metadata and update only fields derived from tracking.
  command.apply({
    ...command.current,
    status: latest.status,
    statusCode: latest.statusCode,
    eta: latest.eta,
    containers: latest.containers,
    alerts: latest.alerts,
  })
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

function mapRealtimeEventToRefreshStatus(
  event: SyncRequestRealtimeEvent,
  syncRequestIdSet: ReadonlySet<string>,
): RefreshStatusRequest | null {
  const row = event.row ?? event.oldRow
  if (!row) return null
  if (!syncRequestIdSet.has(row.id)) return null

  if (event.eventType === 'DELETE') {
    return {
      syncRequestId: row.id,
      status: 'NOT_FOUND',
      lastError: 'sync_request_not_found',
      updatedAt: row.updated_at,
      refValue: row.ref_value,
    }
  }

  return {
    syncRequestId: row.id,
    status: row.status,
    lastError: row.last_error,
    updatedAt: row.updated_at,
    refValue: row.ref_value,
  }
}

function applyRefreshStatusRequests(
  statusBySyncRequestId: Map<string, RefreshStatusRequest>,
  requests: readonly RefreshStatusRequest[],
): void {
  for (const request of requests) {
    statusBySyncRequestId.set(request.syncRequestId, request)
  }
}

function toRefreshStatusResponseFromMap(
  syncRequestIds: readonly string[],
  statusBySyncRequestId: ReadonlyMap<string, RefreshStatusRequest>,
): RefreshStatusResponse {
  const requests = syncRequestIds.map((syncRequestId) => {
    const known = statusBySyncRequestId.get(syncRequestId)
    if (known) return known

    return {
      syncRequestId,
      status: 'NOT_FOUND' as const,
      lastError: 'sync_request_not_found',
      updatedAt: null,
      refValue: null,
    }
  })

  const allTerminal = requests.every((request) => {
    return (
      request.status === 'DONE' || request.status === 'FAILED' || request.status === 'NOT_FOUND'
    )
  })

  return {
    ok: true,
    allTerminal,
    requests,
  }
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
  params.set('_ts', String(Date.now()))

  const response = await fetch(`/api/refresh/status?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
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

type WaitForTerminalSyncRequestsCommand = {
  readonly syncRequestIds: readonly string[]
  readonly setRefreshRetry: (value: RefreshRetryState | null) => void
  readonly setRealtimeCleanup: (cleanup: (() => void) | null) => void
  readonly isDisposed: () => boolean
}

type WaitForTerminalSyncRequestsResult =
  | {
      readonly kind: 'completed'
      readonly response: RefreshStatusResponse
    }
  | {
      readonly kind: 'timeout'
    }
  | {
      readonly kind: 'cancelled'
    }

async function waitForTerminalSyncRequests(
  command: WaitForTerminalSyncRequestsCommand,
): Promise<WaitForTerminalSyncRequestsResult> {
  const syncRequestIdSet = new Set(command.syncRequestIds)
  const statusBySyncRequestId = new Map<string, RefreshStatusRequest>()

  let isResolved = false
  let resolveRealtimeTerminal: ((response: RefreshStatusResponse) => void) | null = null
  const realtimeTerminalPromise = new Promise<RefreshStatusResponse>((resolve) => {
    resolveRealtimeTerminal = resolve
  })

  const resolveIfAllTerminal = () => {
    if (isResolved || resolveRealtimeTerminal === null) {
      return
    }

    const consolidatedResponse = toRefreshStatusResponseFromMap(
      command.syncRequestIds,
      statusBySyncRequestId,
    )

    if (!consolidatedResponse.allTerminal) {
      return
    }

    isResolved = true
    resolveRealtimeTerminal(consolidatedResponse)
  }

  const realtimeSubscription = subscribeToSyncRequestsRealtimeByIds({
    syncRequestIds: command.syncRequestIds,
    onEvent(event) {
      if (command.isDisposed() || isResolved) return

      const requestStatus = mapRealtimeEventToRefreshStatus(event, syncRequestIdSet)
      if (!requestStatus) return

      statusBySyncRequestId.set(requestStatus.syncRequestId, requestStatus)
      resolveIfAllTerminal()
    },
    onStatus(channelStatus) {
      if (channelStatus.state === 'CHANNEL_ERROR' || channelStatus.state === 'TIMED_OUT') {
        console.warn('[refresh] sync_requests realtime channel degraded', channelStatus)
      }
    },
  })

  command.setRealtimeCleanup(realtimeSubscription.unsubscribe)

  const bootstrapStatus = await fetchRefreshSyncStatuses(command.syncRequestIds)
  applyRefreshStatusRequests(statusBySyncRequestId, bootstrapStatus.requests)
  resolveIfAllTerminal()

  if (isResolved) {
    return {
      kind: 'completed',
      response: toRefreshStatusResponseFromMap(command.syncRequestIds, statusBySyncRequestId),
    }
  }

  const watchdogPromise = pollRefreshSyncStatus({
    syncRequestIds: command.syncRequestIds,
    maxRetries: REFRESH_SYNC_MAX_RETRIES,
    initialDelayMs: REFRESH_SYNC_INITIAL_DELAY_MS,
    fetchSyncStatus: async (syncRequestIds) => {
      const response = await fetchRefreshSyncStatuses(syncRequestIds)
      applyRefreshStatusRequests(statusBySyncRequestId, response.requests)
      resolveIfAllTerminal()
      return response
    },
    onRetryStart(progress) {
      if (!command.isDisposed()) {
        command.setRefreshRetry(progress)
      }
    },
    shouldStop: () => command.isDisposed() || isResolved,
  })
    .then((result) => ({ kind: 'watchdog' as const, result }))
    .catch((error: unknown) => ({ kind: 'watchdog_error' as const, error }))

  const resolution = await Promise.race([
    realtimeTerminalPromise.then((response) => ({ kind: 'realtime' as const, response })),
    watchdogPromise,
  ])

  if (resolution.kind === 'watchdog_error') {
    throw resolution.error
  }

  if (resolution.kind === 'realtime') {
    command.setRefreshRetry(null)
    return {
      kind: 'completed',
      response: resolution.response,
    }
  }

  if (resolution.result.kind === 'cancelled') {
    return { kind: 'cancelled' }
  }

  if (resolution.result.kind === 'timeout') {
    return { kind: 'timeout' }
  }

  return {
    kind: 'completed',
    response: resolution.result.response,
  }
}

async function refreshShipmentContainers(params: RefreshContainersParams): Promise<void> {
  const data = params.data
  if (!data) return

  const containers = data.containers
  if (containers.length === 0) return

  try {
    if (params.isDisposed()) return

    params.setRefreshError(null)
    params.setRefreshHint(null)
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

    // Reflect queued sync requests immediately in chips/header (syncing state) before terminal wait.
    try {
      await params.refreshTrackingData()
    } catch (err) {
      console.error('Failed to refresh tracking data after enqueue:', err)
    }

    const waitResult = await waitForTerminalSyncRequests({
      syncRequestIds: uniqueSyncRequestIds,
      setRefreshRetry: params.setRefreshRetry,
      setRealtimeCleanup(cleanup) {
        params.setRealtimeCleanup(cleanup)
      },
      isDisposed: params.isDisposed,
    })

    if (waitResult.kind === 'cancelled') {
      return
    }

    if (waitResult.kind === 'timeout') {
      params.setRefreshError(params.toTimeoutMessage(REFRESH_SYNC_MAX_RETRIES))
      return
    }

    const finalStatusResponse = waitResult.response

    const failedStatuses = finalStatusResponse.requests.filter((requestStatus) => {
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

    params.setLastRefreshDoneAt(toLatestDoneAtOrNow(finalStatusResponse.requests))
    params.setRefreshError(null)
  } catch (err) {
    const readableMessage = toReadableErrorMessage(err)

    console.error('Failed to refresh containers:', {
      original: err,
      message: readableMessage,
    })
    if (!params.isDisposed()) {
      params.setRefreshError(readableMessage || 'Refresh failed')
    }
  } finally {
    params.setRealtimeCleanup(null)

    const disposed = params.isDisposed()

    if (!disposed) {
      params.setIsRefreshing(false)
      params.setRefreshRetry(null)
    }

    if (!disposed) {
      try {
        await params.refreshTrackingData()
      } catch (err) {
        console.error('Failed to refresh tracking data after sync:', err)
      }
    }
  }
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

function toCreateErrorMessage(value: string | ExistingProcessConflict | null): string {
  if (typeof value === 'string') return value
  return value?.message ?? ''
}

function toCreateErrorExisting(
  value: string | ExistingProcessConflict | null,
): ExistingProcessConflict | undefined {
  if (typeof value === 'string') return undefined
  return value ?? undefined
}

type ProcessDialogsControllerCommand = {
  readonly processId: () => string
  readonly navigate: (to: string) => void
  readonly refetchShipment: () => unknown
}

type ProcessDialogsController = {
  readonly isEditOpen: () => boolean
  readonly closeEditDialog: () => void
  readonly editInitialData: () => CreateProcessDialogFormData | null
  readonly focusFieldOnOpen: () => 'reference' | 'carrier' | null
  readonly handleEditSubmit: (formData: CreateProcessDialogFormData) => Promise<void> // i18n-enforce-ignore
  readonly isCreateDialogOpen: () => boolean
  readonly closeCreateDialog: () => void
  readonly openCreateDialog: () => void
  readonly handleCreateSubmit: (formData: CreateProcessDialogFormData) => Promise<void> // i18n-enforce-ignore
  readonly hasCreateError: () => boolean
  readonly createErrorMessage: () => string
  readonly createErrorExisting: () => ExistingProcessConflict | undefined
  readonly clearCreateError: () => void
  readonly openEditForShipment: (
    shipmentData: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => void
}

function useProcessDialogsController(
  command: ProcessDialogsControllerCommand,
): ProcessDialogsController {
  const [isEditOpen, setIsEditOpen] = createSignal(false)
  const [editInitialData, setEditInitialData] = createSignal<CreateProcessDialogFormData | null>(
    null,
  )
  const [focusFieldOnOpen, setFocusFieldOnOpen] = createSignal<'reference' | 'carrier' | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

  const handleCreateSubmit = async (formData: CreateProcessDialogFormData) => {
    try {
      try {
        const resultId = await createProcessRequest(toCreateProcessInput(formData))
        setIsCreateDialogOpen(false)
        command.navigate(`/shipments/${resultId}`)
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
        await updateProcessRequest(command.processId(), input)

        await command.refetchShipment()
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
      setIsEditOpen(false)
    }
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

  return {
    isEditOpen,
    closeEditDialog: () => {
      setIsEditOpen(false)
      setFocusFieldOnOpen(null)
    },
    editInitialData,
    focusFieldOnOpen,
    handleEditSubmit,
    isCreateDialogOpen,
    closeCreateDialog: () => setIsCreateDialogOpen(false),
    openCreateDialog: () => setIsCreateDialogOpen(true),
    handleCreateSubmit,
    hasCreateError: () => Boolean(createError()),
    createErrorMessage: () => toCreateErrorMessage(createError()),
    createErrorExisting: () => toCreateErrorExisting(createError()),
    clearCreateError: () => setCreateError(null),
    openEditForShipment,
  }
}

type AlertActionsCommand = {
  readonly acknowledgeErrorMessage: string
  readonly unacknowledgeErrorMessage: string
  readonly refetchShipment: () => unknown
  readonly updateAlerts: (
    updater: (current: readonly AlertDisplayVM[]) => readonly AlertDisplayVM[],
  ) => void
}

type AlertActionsController = {
  readonly busyAlertIds: () => ReadonlySet<string>
  readonly collapsingAlertIds: () => ReadonlySet<string>
  readonly alertActionError: () => string | null
  readonly clearAlertActionError: () => void
  readonly acknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
  readonly unacknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function useAlertActionsController(command: AlertActionsCommand): AlertActionsController {
  const [busyAlertIds, setBusyAlertIds] = createSignal<ReadonlySet<string>>(new Set())
  const [collapsingAlertIds, setCollapsingAlertIds] = createSignal<ReadonlySet<string>>(new Set())
  const [alertActionError, setAlertActionError] = createSignal<string | null>(null)

  const acknowledgeAlert = async (alertId: string) => {
    if (busyAlertIds().has(alertId)) return
    setAlertActionError(null)
    setBusyAlertIds((prev) => withSetEntry(prev, alertId))

    try {
      await acknowledgeTrackingAlertRequest(alertId)
      setCollapsingAlertIds((prev) => withSetEntry(prev, alertId))
      await wait(180)
      command.updateAlerts((alerts) => {
        return withAlertMarkedAsAcknowledged(alerts, alertId, new Date().toISOString())
      })
      await command.refetchShipment()
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
      setAlertActionError(command.acknowledgeErrorMessage)
    } finally {
      setBusyAlertIds((prev) => withoutSetEntry(prev, alertId))
      setCollapsingAlertIds((prev) => withoutSetEntry(prev, alertId))
    }
  }

  const unacknowledgeAlert = async (alertId: string) => {
    if (busyAlertIds().has(alertId)) return
    setAlertActionError(null)
    setBusyAlertIds((prev) => withSetEntry(prev, alertId))

    try {
      await unacknowledgeTrackingAlertRequest(alertId)
      command.updateAlerts((alerts) => withAlertMarkedAsActive(alerts, alertId))
      await command.refetchShipment()
    } catch (err) {
      console.error('Failed to unacknowledge alert:', err)
      setAlertActionError(command.unacknowledgeErrorMessage)
    } finally {
      setBusyAlertIds((prev) => withoutSetEntry(prev, alertId))
    }
  }

  return {
    busyAlertIds,
    collapsingAlertIds,
    alertActionError,
    clearAlertActionError: () => setAlertActionError(null),
    acknowledgeAlert,
    unacknowledgeAlert,
  }
}

export function ShipmentView(props: { params: { id: string } }): JSX.Element {
  const { locale, t, keys } = useTranslation()
  const [shipment, { refetch, mutate }] = createResource(
    () => [props.params.id, locale()] as const,
    ([id, currentLocale]) => fetchProcess(id, currentLocale),
  )
  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const [refreshRetry, setRefreshRetry] = createSignal<RefreshRetryState | null>(null)
  const [refreshError, setRefreshError] = createSignal<string | null>(null)
  const [refreshHint, setRefreshHint] = createSignal<string | null>(null)
  const [lastRefreshDoneAt, setLastRefreshDoneAt] = createSignal<Date | null>(null)
  let disposed = false
  let activeRealtimeCleanup: (() => void) | null = null
  onCleanup(() => {
    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }
    disposed = true
  })
  const refreshTrackingData = () =>
    refreshTrackingDataOnly({
      processId: props.params.id,
      locale: locale(),
      current: shipment(),
      apply: mutate,
    })
  const syncNow = useSyncRealtimeCoordinator({
    shipment,
    isRefreshing,
    refreshTrackingData,
    isDisposed: () => disposed,
  })
  const triggerRefresh = async () => {
    const doneAt = lastRefreshDoneAt()
    if (doneAt) {
      const elapsedMs = Date.now() - doneAt.getTime()
      if (elapsedMs < REFRESH_SOFT_BLOCK_WINDOW_MS) {
        setRefreshError(null)
        setRefreshHint(
          buildRecentUpdateHint({
            elapsedMs,
            toSecondsLabel: (count) =>
              t(keys.shipmentView.refreshRecentlyUpdatedSeconds, { count }),
            toMinutesLabel: (count) =>
              t(keys.shipmentView.refreshRecentlyUpdatedMinutes, { count }),
          }),
        )
        return
      }
    }

    setRefreshHint(null)

    await refreshShipmentContainers({
      data: shipment(),
      setIsRefreshing,
      setRefreshError,
      setRefreshHint,
      setRefreshRetry,
      setLastRefreshDoneAt,
      setRealtimeCleanup(cleanup) {
        if (activeRealtimeCleanup) {
          activeRealtimeCleanup()
          activeRealtimeCleanup = null
        }
        activeRealtimeCleanup = cleanup
      },
      refreshTrackingData,
      isDisposed: () => disposed,
      toTimeoutMessage: (totalRetries) =>
        t(keys.shipmentView.refreshSyncTimeout, { total: totalRetries }),
      toFailedMessage: (failedCount, firstError) =>
        t(keys.shipmentView.refreshSyncFailed, { failedCount, firstError }),
    })
  }

  const navigate = useNavigate()
  const dialogs = useProcessDialogsController({
    processId: () => props.params.id,
    navigate,
    refetchShipment: () => refetch(),
  })

  const alertActions = useAlertActionsController({
    acknowledgeErrorMessage: t(keys.shipmentView.alerts.action.errorAcknowledge),
    unacknowledgeErrorMessage: t(keys.shipmentView.alerts.action.errorUnacknowledge),
    refetchShipment: () => refetch(),
    updateAlerts: (updater) => {
      mutate((current) => {
        if (!current) return current
        return {
          ...current,
          alerts: updater(current.alerts),
        }
      })
    },
  })

  const [selectedContainerId, setSelectedContainerId] = createSignal<string>('')

  const selectedContainer = createMemo(() => {
    const data = shipment()
    if (!data) return null
    const containers = data.containers
    if (containers.length === 0) return null

    const selected = selectedContainerId()
    if (selected) {
      return containers.find((c) => String(c.id) === String(selected)) ?? containers[0]
    }
    return containers[0]
  })

  const selectedContainerEtaVm = createMemo<ContainerEtaDetailVM>(() => {
    const selected = selectedContainer()
    if (!selected) return null
    return selected.selectedEtaVm
  })

  const activeAlerts = createMemo<readonly AlertDisplayVM[]>(() => {
    const data = shipment()
    if (!data) return []
    return toSortedActiveAlerts(data.alerts)
  })

  const archivedAlerts = createMemo<readonly AlertDisplayVM[]>(() => {
    const data = shipment()
    if (!data) return []
    return toSortedArchivedAlerts(data.alerts)
  })

  // Update selected container when data loads
  createEffect(() => {
    const data = shipment()
    if (data && data.containers.length > 0 && !selectedContainerId()) {
      setSelectedContainerId(String(data.containers[0].id))
    }
  })

  return (
    <ShipmentViewLayout
      refreshError={refreshError()}
      alertActionError={alertActions.alertActionError()}
      refreshHint={refreshHint()}
      onDismissRefreshError={() => setRefreshError(null)}
      onDismissAlertActionError={alertActions.clearAlertActionError}
      isEditOpen={dialogs.isEditOpen()}
      onCloseEdit={dialogs.closeEditDialog}
      editInitialData={dialogs.editInitialData()}
      focusFieldOnOpen={dialogs.focusFieldOnOpen()}
      onEditSubmit={dialogs.handleEditSubmit}
      isCreateDialogOpen={dialogs.isCreateDialogOpen()}
      onCloseCreate={dialogs.closeCreateDialog}
      onCreateSubmit={dialogs.handleCreateSubmit}
      hasCreateError={dialogs.hasCreateError()}
      createErrorMessage={dialogs.createErrorMessage()}
      createErrorExisting={dialogs.createErrorExisting()}
      onAcknowledgeCreateError={dialogs.clearCreateError}
      shipmentData={shipment()}
      shipmentLoading={shipment.loading}
      shipmentError={shipment.error}
      activeAlerts={activeAlerts()}
      archivedAlerts={archivedAlerts()}
      busyAlertIds={alertActions.busyAlertIds()}
      collapsingAlertIds={alertActions.collapsingAlertIds()}
      isRefreshing={isRefreshing()}
      refreshRetry={refreshRetry()}
      syncNow={syncNow()}
      onTriggerRefresh={triggerRefresh}
      onAcknowledgeAlert={alertActions.acknowledgeAlert}
      onUnacknowledgeAlert={alertActions.unacknowledgeAlert}
      selectedContainerId={selectedContainerId()}
      onSelectContainer={(id) => setSelectedContainerId(String(id))}
      selectedContainer={selectedContainer()}
      selectedContainerEtaVm={selectedContainerEtaVm()}
      onOpenEditForShipment={dialogs.openEditForShipment}
      onOpenCreateProcess={dialogs.openCreateDialog}
    />
  )
}
