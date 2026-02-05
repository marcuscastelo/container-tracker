import { A, useNavigate, useParams } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, Show } from 'solid-js'
import { useTranslation } from '~/i18n'
import { CreateProcessDialog } from '~/modules/process'
import type { FormData as ProcessFormData } from '~/modules/process/ui/CreateProcessDialog'
import { AlertsPanel } from '~/modules/shipment/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/shipment/ui/components/ContainersPanel'
import { ChevronLeftIcon } from '~/modules/shipment/ui/components/Icons'
import { ShipmentHeader } from '~/modules/shipment/ui/components/ShipmentHeader'
import { TimelinePanel } from '~/modules/shipment/ui/components/TimelinePanel'
import { fetchProcess } from '~/modules/shipment/ui/fetchProcess'
import { AppHeader, ExistingProcessError } from '~/shared/ui'

const keys = {
  backToList: 'shipmentView.backToList',
  shipmentHeader: 'shipmentView.header',
  origin: 'shipmentView.origin',
  destination: 'shipmentView.destination',
  status: 'shipmentView.status',
  eta: 'shipmentView.eta',
  containersTitle: 'shipmentView.containers.title',
  timelineTitle: 'shipmentView.timeline.title',
  timelineExpected: 'shipmentView.timeline.expected',
  timelineActual: 'shipmentView.timeline.actual',
  alertsTitle: 'shipmentView.alerts.title',
  alertsEmpty: 'shipmentView.alerts.empty',
  carrier: 'shipmentView.carrier',
  etaMissing: 'shipmentView.etaMissing',
  loading: 'shipmentView.loading',
  notFound: 'shipmentView.notFound',
  noEvents: 'shipmentView.noEvents',
  processCreated: 'shipmentView.processCreated',
  internalIdMessage: 'shipmentView.internalIdMessage',
  internalIdCTA: 'shipmentView.internalIdCTA',
}

export function ShipmentView(): JSX.Element {
  const { t } = useTranslation()
  const params = useParams()

  const [shipment, { refetch }] = createResource(
    () => params.id,
    (id) => fetchProcess(id),
  )

  const [isRefreshing, setIsRefreshing] = createSignal(false)

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
      console.error('Failed to refresh containers:', err)
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
  const [editInitialData, setEditInitialData] = createSignal<ProcessFormData | null>(null)
  const [focusReferenceOnOpen, setFocusReferenceOnOpen] = createSignal(false)

  // Create dialog state (header "Create process" button uses this)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const navigate = useNavigate()
  const [createError, setCreateError] = createSignal<
    | string
    | { message: string; processId?: string; containerId?: string; containerNumber?: string }
    | null
  >(null)

  // Copy button state is handled by shared `CopyButton` component

  const handleCreateSubmit = async (formData: ProcessFormData) => {
    try {
      // Map UI form data to API shape
      const input: Record<string, unknown> = {
        reference: formData.reference || null,
        operation_type: formData.operationType || undefined,
        origin: formData.origin ? { display_name: formData.origin } : null,
        destination: formData.destination ? { display_name: formData.destination } : null,
        carrier: formData.carrier || null,
        bl_reference: formData.blReference || null,
        containers: formData.containers.map((c) => ({
          container_number: c.containerNumber,
          iso_type: c.isoType || null,
        })),
      }

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!res.ok) {
        const json: unknown = await res.json().catch(() => ({ error: res.statusText }))
        const asObj = json as Record<string, unknown>
        if (res.status === 409 && asObj && asObj.existing && typeof asObj.existing === 'object') {
          const existing = asObj.existing as Record<string, unknown>
          const processId = String(existing.processId ?? existing.process_id ?? '')
          setIsCreateDialogOpen(false)
          // Show banner with link instead of auto-navigating so user sees the message
          setCreateError({
            message: String(asObj.error ?? asObj.message ?? 'Container already exists'),
            processId,
            containerId: String(existing.containerId ?? existing.container_id ?? ''),
            containerNumber: String(existing.containerNumber ?? existing.container_number ?? ''),
          })
          return
        }
        throw new Error(
          String((asObj && (asObj.error ?? asObj.message)) ?? 'Failed to create process'),
        )
      }

      const result = await res.json().catch(() => null)
      setIsCreateDialogOpen(false)

      // Navigate to the created process if we have an id
      const newId = result?.process?.id ?? result?.id
      if (newId) navigate(`/shipments/${newId}`)
    } catch (err) {
      console.error('Failed to create process:', err)
      setIsCreateDialogOpen(false)
    }
  }

  const handleEditSubmit = async (formData: ProcessFormData) => {
    try {
      // Map UI form data to API shape
      const input: Record<string, unknown> = {
        reference: formData.reference || null,
        operation_type: formData.operationType || undefined,
        origin: formData.origin ? { display_name: formData.origin } : null,
        destination: formData.destination ? { display_name: formData.destination } : null,
        carrier: formData.carrier || null,
        bl_reference: formData.blReference || null,
        containers: formData.containers.map((c) => ({
          container_number: c.containerNumber,
          iso_type: c.isoType || null,
        })),
      }

      const res = await fetch(`/api/processes/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!res.ok) {
        // Try to surface structured conflict info (existing container) to the UI
        const json: unknown = await res.json().catch(() => ({ error: res.statusText }))
        const asObj = json as Record<string, unknown>
        if (res.status === 409 && asObj && asObj.existing && typeof asObj.existing === 'object') {
          const existing = asObj.existing as Record<string, unknown>
          const processId = String(existing.processId ?? existing.process_id ?? '')
          setIsEditOpen(false)
          setCreateError({
            message: String(asObj.error ?? asObj.message ?? 'Container already exists'),
            processId,
            containerId: String(existing.containerId ?? existing.container_id ?? ''),
            containerNumber: String(existing.containerNumber ?? existing.container_number ?? ''),
          })
          return
        }
        throw new Error(`Failed to update process: ${res.statusText}`)
      }

      // Refresh data
      await refetch()
      setIsEditOpen(false)
    } catch (err) {
      console.error('Failed to update process:', err)
      // Show structured existing conflict if present
      if (err && typeof err === 'object') {
        const r = err as Record<string, unknown>
        if (r.existing && typeof r.existing === 'object') {
          const ex = r.existing as Record<string, unknown>
          setCreateError({
            message: String(r.message ?? 'Container already exists'),
            processId: String(ex.processId ?? ex.process_id ?? ''),
            containerId: String(ex.containerId ?? ex.container_id ?? ''),
            containerNumber: String(ex.containerNumber ?? ex.container_number ?? ''),
          })
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
  createMemo(() => {
    const data = shipment()
    if (data && data.containers.length > 0 && !selectedContainerId()) {
      setSelectedContainerId(data.containers[0].id)
    }
  })

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader onCreateProcess={() => setIsCreateDialogOpen(true)} />

      {/* Edit process dialog (when editing current shipment) */}
      <CreateProcessDialog
        open={isEditOpen()}
        onClose={() => {
          setIsEditOpen(false)
          setFocusReferenceOnOpen(false)
        }}
        initialData={editInitialData()}
        mode="edit"
        focusReference={focusReferenceOnOpen()}
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
          {t(keys.backToList)}
        </A>

        {/* Show conflict banner when create/edit results in an existing-container conflict */}
        <Show when={createError()}>
          <ExistingProcessError
            message={
              typeof createError() === 'string'
                ? (createError() as string)
                : String((createError() as Record<string, unknown>).message ?? '')
            }
            existing={
              createError() && typeof createError() === 'object'
                ? {
                    processId: String((createError() as Record<string, unknown>).processId ?? ''),
                    containerId: String(
                      (createError() as Record<string, unknown>).containerId ?? '',
                    ),
                  }
                : undefined
            }
            onAcknowledge={() => setCreateError(null)}
          />
        </Show>

        {/* Loading state */}
        <Show when={shipment.loading}>
          <div class="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p class="text-slate-500">Loading...</p>
          </div>
        </Show>

        {/* Error/Not found state */}
        <Show when={shipment.error || (shipment() === null && !shipment.loading)}>
          <div class="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p class="text-red-500">Process not found</p>
            <A href="/" class="mt-4 inline-block text-sm text-slate-600 hover:text-slate-900">
              Back to dashboard
            </A>
          </div>
        </Show>

        {/* Shipment content */}
        <Show when={shipment()}>
          {(data) => (
            <>
              <ShipmentHeader
                t={t}
                keys={keys}
                data={data()}
                isRefreshing={isRefreshing()}
                onTriggerRefresh={() => triggerRefresh()}
                onOpenEdit={() => {
                  const d = data()
                  if (!d) return
                  const initial = {
                    reference: d.reference ?? '',
                    operationType: d.operationType ?? '',
                    origin: d.origin || '',
                    destination: d.destination || '',
                    containers: d.containers.map((c) => ({
                      id: c.id,
                      containerNumber: c.number,
                      isoType: c.isoType ?? '',
                    })),
                    carrier: d.carrier || '',
                    blReference: d.bl_reference ?? '',
                  }
                  setEditInitialData(initial)
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
                  <AlertsPanel alerts={data().alerts} t={t} keys={keys} />
                </div>
              </div>
            </>
          )}
        </Show>
      </main>
    </div>
  )
}
