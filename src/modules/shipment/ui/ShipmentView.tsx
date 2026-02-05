import { A, useNavigate, useParams } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { useTranslation } from '~/i18n'
import { CreateProcessDialog } from '~/modules/process'
import type { FormData as ProcessFormData } from '~/modules/process/ui/CreateProcessDialog'
import {
  AppHeader,
  CopyButton,
  ExistingProcessError,
  StatusBadge,
  type StatusVariant,
} from '~/shared/ui'

// carrierTrackUrl and copyToClipboard are used by TimelineNode; moved to component

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

// Return a tracking URL for common carriers. If unknown, returns a safe search fallback.
// carrierTrackUrl moved to shared util: ~/shared/utils/carrier

// copyToClipboard moved to shared util: ~/shared/utils/clipboard

import { AlertsList } from '~/modules/shipment/ui/components/AlertsList'
import { ContainerSelector } from '~/modules/shipment/ui/components/ContainerSelector'
import { ArrowIcon, ChevronLeftIcon } from '~/modules/shipment/ui/components/Icons'
// Domain types for the shipment view
import { TimelineNode } from '~/modules/shipment/ui/components/TimelineNode'
import { fetchProcess } from '~/modules/shipment/ui/fetchProcess'

// Components extracted to `./components` to keep this file focused

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
  const [showInternalIdInfo, setShowInternalIdInfo] = createSignal(false)
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
              {/* Shipment Header Card */}
              <section class="mb-6 rounded-lg border border-slate-200 bg-white p-6">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 class="text-xl font-semibold text-slate-900">
                      {t(keys.shipmentHeader)} {data().processRef}
                      <Show when={!data().reference}>
                        <span class="relative inline-block ml-2">
                          <button
                            type="button"
                            aria-label={t(keys.internalIdMessage)}
                            class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-blue-600 text-xs font-medium hover:bg-slate-200 animate-pulse hover:cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => setShowInternalIdInfo((s) => !s)}
                          >
                            i
                          </button>

                          <div
                            class={`absolute right-0 z-10 mt-2 w-64 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg ${
                              showInternalIdInfo() ? '' : 'hidden'
                            }`}
                            role="dialog"
                            aria-hidden={!showInternalIdInfo()}
                          >
                            <p class="text-xs text-slate-700">{t(keys.internalIdMessage)}</p>
                            <div class="mt-2 text-right">
                              <button
                                type="button"
                                class="rounded outline bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                onClick={() => {
                                  // Prepare initial form data and open edit dialog
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
                                    blReference: d.bl_reference || '',
                                  }
                                  setEditInitialData(initial)
                                  // request autofocus on the reference field when opening the edit dialog
                                  setFocusReferenceOnOpen(true)
                                  setIsEditOpen(true)
                                  setShowInternalIdInfo(false)
                                }}
                              >
                                {t(keys.internalIdCTA)}
                              </button>
                            </div>
                          </div>
                        </span>
                      </Show>
                    </h1>
                    <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <span>{data().origin}</span>
                      <ArrowIcon />
                      <span>{data().destination}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-6">
                    <div class="text-right">
                      <p class="text-xs uppercase text-slate-500">{t(keys.status)}</p>
                      <StatusBadge variant={data().status} label={data().statusLabel} />
                    </div>
                    <div class="text-center">
                      <p class="text-xs uppercase text-slate-500">{t(keys.carrier)}</p>
                      <p class="text-sm font-medium text-slate-900">{data().carrier ?? '—'}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs uppercase text-slate-500">{t(keys.eta)}</p>
                      <p class="text-sm font-medium text-slate-900">
                        {data().eta ?? t(keys.etaMissing)}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => triggerRefresh()}
                        class={`rounded-md p-2 text-slate-500 hover:bg-slate-100 ${
                          isRefreshing() ? 'opacity-60 pointer-events-none' : ''
                        }`}
                        title="Refresh"
                        aria-busy={isRefreshing()}
                        disabled={isRefreshing()}
                      >
                        {isRefreshing() ? (
                          <svg
                            class="h-4 w-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
                            <path
                              d="M22 12a10 10 0 00-10-10"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 4v6h6M20 20v-6h-6"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // prepare initial form data
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
                            blReference: d.bl_reference || '',
                          }
                          setEditInitialData(initial)
                          setIsEditOpen(true)
                        }}
                        class="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                        title="Edit"
                      >
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15.232 5.232l3.536 3.536M4 20l7.5-1.5L20 9l-7.5-7.5L4 20z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <div class="grid gap-6 lg:grid-cols-3">
                {/* Left column: Container selector + Timeline */}
                <div class="lg:col-span-2 space-y-6">
                  {/* Container Selector */}
                  <section class="rounded-lg border border-slate-200 bg-white">
                    <header class="border-b border-slate-200 px-6 py-4">
                      <h2 class="text-base font-semibold text-slate-900">
                        {t(keys.containersTitle)} ({data().containers.length})
                      </h2>
                    </header>
                    <ContainerSelector
                      containers={data().containers}
                      selectedId={selectedContainerId()}
                      onSelect={(id) => setSelectedContainerId(id)}
                    />
                  </section>

                  {/* Timeline */}
                  <section class="rounded-lg border border-slate-200 bg-white">
                    <header class="border-b border-slate-200 px-6 py-4">
                      <h2 class="text-base font-semibold text-slate-900">
                        {t(keys.timelineTitle)}
                      </h2>
                      <Show when={selectedContainer()}>
                        <p class="mt-1 text-xs text-slate-500">
                          {selectedContainer()?.number} •{' '}
                          <StatusBadge
                            variant={selectedContainer()?.status ?? 'unknown'}
                            label={selectedContainer()?.statusLabel ?? ''}
                          />
                        </p>
                      </Show>
                    </header>
                    <div class="p-6">
                      <Show
                        when={
                          selectedContainer()?.timeline && selectedContainer()!.timeline.length > 0
                        }
                        fallback={
                          <p class="py-4 text-center text-sm text-slate-500">
                            No events recorded yet
                          </p>
                        }
                      >
                        <div>
                          <For each={selectedContainer()?.timeline ?? []}>
                            {(event, index) => (
                              <TimelineNode
                                event={event}
                                isLast={index() === (selectedContainer()?.timeline.length ?? 0) - 1}
                                carrier={data().carrier}
                                containerNumber={selectedContainer()?.number}
                              />
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </section>
                </div>

                {/* Right column: Alerts */}
                <div>
                  <section class="rounded-lg border border-slate-200 bg-white">
                    <header class="border-b border-slate-200 px-6 py-4">
                      <h2 class="text-base font-semibold text-slate-900">{t(keys.alertsTitle)}</h2>
                    </header>
                    <div class="p-4">
                      <Show
                        when={data().alerts.length > 0}
                        fallback={
                          <p class="py-4 text-center text-sm text-slate-500">
                            {t(keys.alertsEmpty)}
                          </p>
                        }
                      >
                        <ul class="space-y-3">
                          <AlertsList alerts={data().alerts} />
                        </ul>
                      </Show>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </Show>
      </main>
    </div>
  )
}
