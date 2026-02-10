import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, Show } from 'solid-js'
import z from 'zod'
import type { CreateProcessInput } from '~/modules/process/domain/processStuff'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/process/ui/components/ContainersPanel'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import { ShipmentHeader } from '~/modules/process/ui/components/ShipmentHeader'
import { TimelinePanel } from '~/modules/process/ui/components/TimelinePanel'
import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'
import {
  CreateProcessResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'
import { isRecord } from '~/shared/utils/typeGuards'

export function ShipmentView(props: { params: { id: string } }): JSX.Element {
  const { t, keys } = useTranslation()

  const [shipment, { refetch }] = createResource(
    () => props.params.id,
    (id) => fetchProcess(id),
  )

  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const [refreshError, setRefreshError] = createSignal<string | null>(null)

  async function triggerRefresh() {
    const data = shipment()
    if (!data) return
    const containers = data.containers
    if (!containers || containers.length === 0) return

    try {
      setIsRefreshing(true)
      // For each container, call POST /api/refresh with container and carrier
      const promises = containers.map((c) =>
        fetch('/api/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ container: c.number, carrier: data.carrier ?? null }),
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`refresh failed for ${c.number}: ${res.status} ${text}`)
          }
          return res.json().catch(() => ({}))
        }),
      )

      // Wait for all refreshes to finish (failures will reject)
      await Promise.all(promises)
    } catch (err) {
      // Improve client-side logging and show a compact banner for the user
      try {
        const msg = err instanceof Error ? err.message : String(err)

        // Attempt a simple regex to extract a useful nested `message` field
        // This handles cases where the server returned a JSON string (possibly escaped).
        let niceMessage = msg
        const m = msg.match(/"message"\s*:\s*"([^"]+)"/)
        if (m?.[1]) {
          niceMessage = m[1]
        } else {
          // Fallback: try to show only the part after the HTTP status code
          const afterStatus = msg.replace(/^.*?:\s*\d{3}\s*/, '')
          if (afterStatus && afterStatus.length > 0 && afterStatus.length < msg.length) {
            niceMessage = afterStatus.trim()
          }
        }

        console.error('Failed to refresh containers (readable):', {
          original: err,
          message: niceMessage,
        })

        // Show a small banner to the user with a short message
        setRefreshError(niceMessage || 'Refresh failed')
      } catch (loggingErr) {
        console.error('Failed to refresh containers (fallback):', err, loggingErr)
        setRefreshError('Refresh failed')
      }
    } finally {
      setIsRefreshing(false)
      // After syncing with external APIs, refetch the process data
      try {
        await refetch()
      } catch (err) {
        console.error('Failed to refetch after refresh:', err)
      }
    }
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
  const [createError, setCreateError] = createSignal<
    | string
    | { message: string; processId?: string; containerId?: string; containerNumber?: string }
    | null
  >(null)

  // Copy button state is handled by shared `CopyButton` component

  const handleCreateSubmit = async (formData: CreateProcessDialogFormData) => {
    try {
      // Map UI form data to API shape
      const input: Record<string, unknown> = {
        reference: formData.reference || null,
        origin: formData.origin ? { display_name: formData.origin } : null,
        destination: formData.destination ? { display_name: formData.destination } : null,
        carrier: formData.carrier || null,
        bill_of_lading: formData.billOfLading || null,
        booking_number: formData.bookingNumber || null,
        importer_name: formData.importerName || null,
        exporter_name: formData.exporterName || null,
        reference_importer: formData.referenceImporter || null,
        product: formData.product || null,
        redestination_number: formData.redestinationNumber || null,
        containers: formData.containers.map((c) => ({
          container_number: c.containerNumber,
          carrier_code: formData.carrier || null,
        })),
      }

      try {
        const result = await typedFetch(
          '/api/processes',
          {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' },
          },
          CreateProcessResponseSchema,
        )
        setIsCreateDialogOpen(false)
        const newId = result.process?.id
        if (newId) navigate(`/shipments/${newId}`)
      } catch (err) {
        if (err instanceof TypedFetchError && err.status === 409) {
          const body = safeParseOrDefault(err.body, z.record(z.string(), z.unknown()), null)
          if (body && 'existing' in body) {
            const existing = safeParseOrDefault(
              body.existing,
              z.record(z.string(), z.unknown()),
              null,
            )
            if (existing) {
              const processId = String(existing.processId ?? existing.process_id ?? '')
              setIsCreateDialogOpen(false)
              setCreateError({
                message: String(body.error ?? 'Container already exists'),
                processId,
                containerId: String(existing.containerId ?? existing.container_id ?? ''),
                containerNumber: String(
                  existing.containerNumber ?? existing.container_number ?? '',
                ),
              })
              return
            }
          }
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
      // Map UI form data to API shape
      const input: CreateProcessInput = {
        reference: formData.reference || null,
        origin: formData.origin ? { display_name: formData.origin } : null,
        destination: formData.destination ? { display_name: formData.destination } : null,
        carrier: formData.carrier || null,
        bill_of_lading: formData.billOfLading || null,
        booking_number: formData.bookingNumber || null,
        importer_name: formData.importerName || null,
        exporter_name: formData.exporterName || null,
        reference_importer: formData.referenceImporter || null,
        product: formData.product || null,
        redestination_number: formData.redestinationNumber || null,
        containers: formData.containers.map((c) => ({
          container_number: c.containerNumber,
          carrier_code: formData.carrier || null,
        })),
      }

      try {
        await typedFetch(
          `/api/processes/${props.params.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' },
          },
          ProcessResponseSchema,
        )

        // Refresh data
        await refetch()
        setIsEditOpen(false)
      } catch (err) {
        if (err instanceof TypedFetchError && err.status === 409) {
          const body = safeParseOrDefault(err.body, z.record(z.string(), z.unknown()), null)
          if (body && 'existing' in body) {
            const existing = safeParseOrDefault(
              body.existing,
              z.record(z.string(), z.unknown()),
              null,
            )
            if (existing) {
              const processId = String(existing.processId ?? existing.process_id ?? '')
              setIsEditOpen(false)
              setCreateError({
                message: String(body.error ?? 'Container already exists'),
                processId,
                containerId: String(existing.containerId ?? existing.container_id ?? ''),
                containerNumber: String(
                  existing.containerNumber ?? existing.container_number ?? '',
                ),
              })
              return
            }
          }
        }
        throw err
      }
    } catch (err) {
      console.error('Failed to update process:', err)
      // Show structured existing conflict if present
      if (err && typeof err === 'object') {
        const body = safeParseOrDefault(err, z.record(z.string(), z.unknown()), null)
        if (body && 'existing' in body) {
          const ex = safeParseOrDefault(body.existing, z.record(z.string(), z.unknown()), null)
          if (ex) {
            setCreateError({
              message: String(
                isRecord(body) && typeof body.message === 'string'
                  ? body.message
                  : 'Container already exists',
              ),
              processId: String(ex.processId ?? ex.process_id ?? ''),
              containerId: String(ex.processId ?? ex.container_id ?? ''),
              containerNumber: String(ex.containerNumber ?? ex.container_number ?? ''),
            })
          }
        }
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

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader onCreateProcess={() => setIsCreateDialogOpen(true)} />

      {/* Inline compact banner for refresh errors (appears after a failed refresh) */}
      <Show when={refreshError()}>
        <div class="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div class="flex items-start justify-between gap-4">
              <div>{refreshError()}</div>
              <button
                type="button"
                class="ml-4 text-red-700 underline"
                aria-label="Dismiss error"
                onClick={() => setRefreshError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit process dialog (when editing current shipment) */}
      <CreateProcessDialog
        open={isEditOpen()}
        onClose={() => {
          setIsEditOpen(false)
          setFocusFieldOnOpen(null)
        }}
        initialData={editInitialData()}
        mode="edit"
        focus={focusFieldOnOpen() ?? undefined}
        onSubmit={handleEditSubmit}
      />

      {/* Create process dialog (triggered from header) */}
      <CreateProcessDialog
        open={isCreateDialogOpen()}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateSubmit}
        mode="create"
      />

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back link */}
        <A
          href="/"
          class="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeftIcon />
          {t(keys.shipmentView.backToList)}
        </A>

        {/* Show conflict banner when create/edit results in an existing-container conflict */}
        <Show when={createError()}>
          <ExistingProcessError
            message={(() => {
              const v = createError()
              if (typeof v === 'string') return v
              const body = safeParseOrDefault(v, z.record(z.string(), z.unknown()), null)
              if (body && typeof body.message === 'string') return body.message
              return ''
            })()}
            existing={(() => {
              const v = createError()
              const body = safeParseOrDefault(v, z.record(z.string(), z.unknown()), null)
              if (body) {
                return {
                  processId: String(body.processId ?? body.process_id ?? ''),
                  containerId: String(body.containerId ?? body.container_id ?? ''),
                }
              }
              return undefined
            })()}
            onAcknowledge={() => setCreateError(null)}
          />
        </Show>

        {/* Loading state */}
        <Show when={shipment.loading}>
          <div class="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p class="text-slate-500">{t(keys.shipmentView.loading)}</p>
          </div>
        </Show>

        {/* Error/Not found state */}
        <Show when={shipment.error || (shipment() === null && !shipment.loading)}>
          <div class="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p class="text-red-500">{t(keys.shipmentView.notFound)}</p>
            <A href="/" class="mt-4 inline-block text-sm text-slate-600 hover:text-slate-900">
              {t(keys.shipmentView.backToDashboard)}
            </A>
          </div>
        </Show>

        {/* Shipment content */}
        <Show when={shipment()}>
          {(data) => (
            <>
              <ShipmentHeader
                data={data()}
                isRefreshing={isRefreshing()}
                onTriggerRefresh={() => triggerRefresh()}
                onOpenEdit={(focus?: 'reference' | 'carrier' | null | undefined) => {
                  const d = data()
                  if (!d) return
                  const initial = {
                    reference: d.reference ?? '',
                    origin: d.origin || '',
                    destination: d.destination || '',
                    containers: d.containers.map((c) => ({
                      id: c.id,
                      containerNumber: c.number,
                    })),
                    carrier: d.carrier ?? 'unknown',
                    billOfLading: d.bill_of_lading ?? '',
                    bookingNumber: d.booking_number ?? '',
                    importerName: d.importer_name ?? '',
                    exporterName: d.exporter_name ?? '',
                    referenceImporter: d.reference_importer ?? '',
                    product: d.product ?? '',
                    redestinationNumber: d.redestination_number ?? '',
                  } satisfies CreateProcessDialogFormData
                  setEditInitialData(initial)
                  // Interpret incoming focus hint
                  if (focus === 'carrier') setFocusFieldOnOpen('carrier')
                  else if (focus === 'reference') setFocusFieldOnOpen('reference')
                  else setFocusFieldOnOpen(null)
                  setIsEditOpen(true)
                }}
              />

              <div class="grid gap-6 lg:grid-cols-3">
                <div class="lg:col-span-2 space-y-6">
                  <ContainersPanel
                    containers={data().containers}
                    selectedId={selectedContainerId()}
                    onSelect={(id) => setSelectedContainerId(id)}
                  />

                  <TimelinePanel selectedContainer={selectedContainer()} carrier={data().carrier} />
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
