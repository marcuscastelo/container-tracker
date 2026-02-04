import { A, useNavigate, useParams } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { useTranslation } from '~/i18n'
import { CreateProcessDialog } from '~/modules/process'
import type { FormData as ProcessFormData } from '~/modules/process/ui/CreateProcessDialog'
import { AppHeader, StatusBadge, type StatusVariant } from '~/shared/ui'

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
}

// Domain types for the shipment view
type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

type TimelineEvent = {
  readonly id: string
  readonly label: string
  readonly location?: string
  readonly date: string | null
  readonly expectedDate?: string | null
  readonly status: EventStatus
}

type AlertDisplay = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'info'
  readonly severity: 'info' | 'success' | 'warning' | 'danger'
  readonly message: string
  readonly timestamp: string
}

type ContainerDetail = {
  readonly id: string
  readonly number: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly timeline: readonly TimelineEvent[]
  readonly isoType?: string | null
}

type ShipmentDetail = {
  readonly id: string
  readonly processRef: string
  readonly reference?: string | null
  readonly operationType?: string
  readonly carrier?: string | null
  readonly bl_reference?: string | null
  readonly origin: string
  readonly destination: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly containers: readonly ContainerDetail[]
  readonly alerts: readonly AlertDisplay[]
}

// API response types
type ProcessApiResponse = {
  id: string
  reference: string | null
  operation_type: string
  origin: { display_name?: string | null } | null
  destination: { display_name?: string | null } | null
  carrier: string | null
  bl_reference: string | null
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    iso_type: string | null
    initial_status: string
  }>
  alerts: Array<{
    id: string
    category: string
    code: string
    severity: string
    title: string
    description: string | null
    state: string
    created_at: string
  }>
}

// Map alert code to display type
function mapAlertType(code: string): AlertDisplay['type'] {
  if (code.startsWith('ETA_')) return 'missing-eta'
  if (code.includes('DELAY') || code.includes('PASSED')) return 'delay'
  if (code.includes('CUSTOMS')) return 'customs'
  return 'info'
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// Fetch process by ID
async function fetchProcess(id: string): Promise<ShipmentDetail | null> {
  const response = await fetch(`/api/processes/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Failed to fetch process: ${response.statusText}`)
  }
  const data: ProcessApiResponse = await response.json()

  // Create a system event for process creation
  const createdAt = new Date(data.created_at)
  const createdEvent: TimelineEvent = {
    id: 'system-created',
    label: 'Process registered in the system',
    location: undefined,
    date: createdAt.toLocaleDateString(),
    status: 'completed',
  }

  return {
    id: data.id,
    processRef: data.reference || `Process ${data.id.slice(0, 8)}`,
    reference: data.reference,
    operationType: data.operation_type,
    carrier: data.carrier,
    bl_reference: data.bl_reference,
    origin: data.origin?.display_name || '—',
    destination: data.destination?.display_name || '—',
    status: 'unknown',
    statusLabel: 'Aguardando dados',
    eta: null,
    containers: data.containers.map((c) => ({
      id: c.id,
      number: c.container_number,
      isoType: c.iso_type ?? null,
      status: 'unknown' as StatusVariant,
      statusLabel: c.initial_status === 'booked' ? 'Booked' : 'Unknown',
      eta: null,
      timeline: [createdEvent], // Only the creation event for now
    })),
    alerts: data.alerts
      .filter((a) => a.state === 'active')
      .map((a) => ({
        id: a.id,
        type: mapAlertType(a.code),
        severity: a.severity as AlertDisplay['severity'],
        message: a.description || a.title,
        timestamp: formatRelativeTime(a.created_at),
      })),
  }
}

function ChevronLeftIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ArrowIcon(): JSX.Element {
  return (
    <svg
      class="h-4 w-4 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  )
}

function AlertIcon(props: { readonly type: AlertDisplay['type'] }): JSX.Element {
  const colorClass = () => {
    switch (props.type) {
      case 'delay':
        return 'text-red-500'
      case 'customs':
        return 'text-amber-500'
      case 'missing-eta':
        return 'text-amber-500'
      default:
        return 'text-blue-500'
    }
  }

  return (
    <svg
      class={`h-5 w-5 ${colorClass()}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

function TimelineNode(props: {
  readonly event: TimelineEvent
  readonly isLast: boolean
}): JSX.Element {
  const nodeStyles = (): { dot: string; line: string; text: string } => {
    switch (props.event.status) {
      case 'completed':
        return {
          dot: 'bg-emerald-500 border-emerald-500',
          line: 'bg-emerald-500',
          text: 'text-slate-900',
        }
      case 'current':
        return {
          dot: 'bg-blue-500 border-blue-500 ring-4 ring-blue-100',
          line: 'bg-slate-200',
          text: 'text-slate-900 font-medium',
        }
      case 'delayed':
        return {
          dot: 'bg-red-500 border-red-500 ring-4 ring-red-100',
          line: 'bg-slate-200',
          text: 'text-red-700 font-medium',
        }
      default:
        return {
          dot: 'bg-white border-slate-300 border-2',
          line: 'bg-slate-200',
          text: 'text-slate-500',
        }
    }
  }

  const styles = nodeStyles()

  return (
    <div class="flex gap-4">
      {/* Timeline node and connector */}
      <div class="flex flex-col items-center">
        <div class={`h-3 w-3 rounded-full ${styles.dot}`} />
        <Show when={!props.isLast}>
          <div class={`w-0.5 flex-1 min-h-12 ${styles.line}`} />
        </Show>
      </div>

      {/* Event content */}
      <div class="flex-1 pb-6">
        <div class="flex items-start justify-between">
          <div>
            <p class={`text-sm ${styles.text}`}>{props.event.label}</p>
            <Show when={props.event.location}>
              <p class="text-xs text-slate-500 mt-0.5">{props.event.location}</p>
            </Show>
          </div>
          <div class="text-right">
            <Show
              when={props.event.date}
              fallback={
                <Show when={props.event.expectedDate}>
                  <p class="text-xs text-slate-400">Est. {props.event.expectedDate}</p>
                </Show>
              }
            >
              <p class="text-xs text-slate-600">{props.event.date}</p>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
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

  // Create dialog state (header "Create process" button uses this)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const navigate = useNavigate()

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
        const error = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(error.error || 'Failed to create process')
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
        throw new Error(`Failed to update process: ${res.statusText}`)
      }

      // Refresh data
      await refetch()
      setIsEditOpen(false)
    } catch (err) {
      console.error('Failed to update process:', err)
      // Could show UI error; for now just log and close
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
        onClose={() => setIsEditOpen(false)}
        initialData={editInitialData()}
        mode="edit"
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
                    <div class="p-4">
                      <div class="flex flex-wrap gap-2">
                        <For each={data().containers}>
                          {(container) => (
                            <button
                              type="button"
                              onClick={() => setSelectedContainerId(container.id)}
                              class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                                selectedContainerId() === container.id
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <span>{container.number}</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
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
                          <For each={data().alerts}>
                            {(alert) => (
                              <li class="flex gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                                <AlertIcon type={alert.type} />
                                <div class="flex-1 min-w-0">
                                  <p class="text-sm text-slate-700">{alert.message}</p>
                                  <p class="mt-1 text-xs text-slate-500">{alert.timestamp}</p>
                                </div>
                              </li>
                            )}
                          </For>
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
