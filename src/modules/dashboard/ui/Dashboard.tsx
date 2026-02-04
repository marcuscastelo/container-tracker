import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createResource, createSignal, For, Show } from 'solid-js'
import { useTranslation } from '~/i18n'
import { presentProcessList } from '~/modules/dashboard/application/processListPresenter'
import { CreateProcessDialog } from '~/modules/process'
import type { CreateProcessInput } from '~/modules/process/domain/process'
import { AppHeader, EmptyState, MetricCard, StatusBadge, type StatusVariant } from '~/shared/ui'

const keys = {
  pageTitle: 'dashboard.pageTitle',
  activeShipments: 'dashboard.metrics.activeShipments',
  inTransit: 'dashboard.metrics.inTransit',
  delays: 'dashboard.metrics.delays',
  arrivalsToday: 'dashboard.metrics.arrivalsToday',
  tableTitle: 'dashboard.table.title',
  colProcess: 'dashboard.table.col.process',
  colCarrier: 'dashboard.table.col.carrier',
  colClient: 'dashboard.table.col.client',
  colRoute: 'dashboard.table.col.route',
  colContainers: 'dashboard.table.col.containers',
  colStatus: 'dashboard.table.col.status',
  colEta: 'dashboard.table.col.eta',
  emptyTitle: 'dashboard.empty.title',
  emptyDescription: 'dashboard.empty.description',
  emptyAction: 'dashboard.empty.action',
  loading: 'dashboard.loading',
  error: 'dashboard.error',
}

// Domain types for the dashboard - derived from API response
type ProcessSummary = {
  readonly id: string
  readonly reference: string | null
  readonly origin: { display_name?: string | null } | null
  readonly destination: { display_name?: string | null } | null
  readonly containerCount: number
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly carrier: string | null
}

// API response type
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
}

// Fetch processes from API
async function fetchProcesses(): Promise<readonly ProcessSummary[]> {
  const response = await fetch('/api/processes')
  if (!response.ok) {
    throw new Error(`Failed to fetch processes: ${response.statusText}`)
  }
  const data: ProcessApiResponse[] = await response.json()

  // Delegate mapping to presenter
  return presentProcessList(data)
}

// Create process via API
async function createProcessApi(input: CreateProcessInput): Promise<{ id: string }> {
  const response = await fetch('/api/processes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to create process')
  }

  const result = await response.json()
  return { id: result.process.id }
}

function ShipIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )
}

function ContainerIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  )
}

function AlertIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
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

function CheckIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function Dashboard(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [processes, { refetch }] = createResource(fetchProcesses)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | null>(null)

  const metrics = () => {
    const data = processes() ?? []
    const activeCount = data.length
    const inTransitCount = data.filter(
      (s) => s.status === 'in-transit' || s.status === 'loaded',
    ).length
    const delayCount = data.filter((s) => s.status === 'delayed').length
    const arrivingToday = data.filter(
      (s) => s.status === 'released' || s.status === 'delivered',
    ).length
    return { activeCount, inTransitCount, delayCount, arrivingToday }
  }

  const handleCreateProcess = () => {
    setCreateError(null)
    setIsCreateDialogOpen(true)
  }

  const handleProcessSubmit = async (data: {
    reference: string
    operationType: string
    origin: string
    destination: string
    containers: Array<{ id: string; containerNumber: string; isoType: string }>
    carrier: string
    blReference: string
  }) => {
    try {
      setCreateError(null)

      // Transform UI form data to API input format
      const input: CreateProcessInput = {
        reference: data.reference || null,
        operation_type: (data.operationType as CreateProcessInput['operation_type']) || undefined,
        origin: data.origin ? { display_name: data.origin } : null,
        destination: data.destination ? { display_name: data.destination } : null,
        carrier: (data.carrier as CreateProcessInput['carrier']) || null,
        bl_reference: data.blReference || null,
        containers: data.containers.map((c) => ({
          container_number: c.containerNumber,
          iso_type: c.isoType || null,
        })),
      }

      const result = await createProcessApi(input)

      // Refetch processes list
      await refetch()

      // Close dialog
      setIsCreateDialogOpen(false)

      // Navigate to the new process
      navigate(`/shipments/${result.id}`)
    } catch (err) {
      console.error('Failed to create process:', err)
      setCreateError(err instanceof Error ? err.message : 'Failed to create process')
    }
  }

  const displayProcessRef = (p: ProcessSummary): string => {
    if (p.reference) return p.reference
    return `<${p.id.slice(0, 8)}>`
  }

  const displayRoute = (p: ProcessSummary): { origin: string; destination: string } => {
    return {
      origin: p.origin?.display_name || '—',
      destination: p.destination?.display_name || '—',
    }
  }

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader onCreateProcess={handleCreateProcess} />
      <CreateProcessDialog
        open={isCreateDialogOpen()}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleProcessSubmit}
      />

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Error message */}
        <Show when={createError()}>
          <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {createError()}
          </div>
        </Show>

        {/* Metrics Grid */}
        <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<ShipIcon />}
            label={t(keys.activeShipments)}
            value={metrics().activeCount}
          />
          <MetricCard
            icon={<ContainerIcon />}
            label={t(keys.inTransit)}
            value={metrics().inTransitCount}
          />
          <MetricCard
            icon={<AlertIcon />}
            label={t(keys.delays)}
            value={metrics().delayCount}
            variant={metrics().delayCount > 0 ? 'warning' : 'default'}
          />
          <MetricCard
            icon={<CheckIcon />}
            label={t(keys.arrivalsToday)}
            value={metrics().arrivingToday}
            variant={metrics().arrivingToday > 0 ? 'success' : 'default'}
          />
        </div>

        {/* Shipments Table */}
        <section class="rounded-lg border border-slate-200 bg-white">
          <header class="border-b border-slate-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-slate-900">{t(keys.tableTitle)}</h2>
          </header>

          <Show when={processes.loading}>
            <div class="px-6 py-12 text-center text-slate-500">Loading...</div>
          </Show>

          <Show when={processes.error}>
            <div class="px-6 py-12 text-center text-red-500">Failed to load processes</div>
          </Show>

          <Show when={!processes.loading && !processes.error}>
            <Show
              when={(processes() ?? []).length > 0}
              fallback={
                <EmptyState
                  title={t(keys.emptyTitle)}
                  description={t(keys.emptyDescription)}
                  actionLabel={t(keys.emptyAction)}
                  onAction={handleCreateProcess}
                />
              }
            >
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th class="px-6 py-3">{t(keys.colProcess)}</th>
                      <th class="px-6 py-3">{t(keys.colCarrier)}</th>
                      <th class="px-6 py-3">{t(keys.colClient)}</th>
                      <th class="px-6 py-3">{t(keys.colRoute)}</th>
                      <th class="px-6 py-3 text-center">{t(keys.colContainers)}</th>
                      <th class="px-6 py-3">{t(keys.colStatus)}</th>
                      <th class="px-6 py-3">{t(keys.colEta)}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <For each={processes()}>
                      {(process) => {
                        const route = displayRoute(process)
                        return (
                          <tr class="transition-colors hover:bg-slate-50">
                            <td class="px-6 py-4">
                              <A
                                href={`/shipments/${process.id}`}
                                class="font-medium text-slate-900 hover:text-slate-700 hover:underline"
                              >
                                {displayProcessRef(process)}
                              </A>
                            </td>
                            <td class="px-6 py-4">
                              <span class="text-sm text-slate-600">{process.carrier ?? '—'}</span>
                            </td>
                            <td class="px-6 py-4">
                              <span class="text-sm text-slate-600">{'<Client>'}</span>
                            </td>
                            <td class="px-6 py-4">
                              <div class="flex items-center gap-2 text-sm text-slate-600">
                                <span>{route.origin}</span>
                                <ArrowIcon />
                                <span>{route.destination}</span>
                              </div>
                            </td>
                            <td class="px-6 py-4 text-center">
                              <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-700">
                                {process.containerCount}
                              </span>
                            </td>
                            <td class="px-6 py-4">
                              <StatusBadge variant={process.status} label={process.statusLabel} />
                            </td>
                            <td class="px-6 py-4 text-sm text-slate-600">
                              <Show
                                when={process.eta}
                                fallback={<span class="text-slate-400">—</span>}
                              >
                                {process.eta}
                              </Show>
                            </td>
                          </tr>
                        )
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </section>
      </main>
    </div>
  )
}
