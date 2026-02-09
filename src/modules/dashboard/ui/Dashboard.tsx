import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createResource, createSignal, For, Show } from 'solid-js'
import z from 'zod'
import { presentProcessList } from '~/modules/dashboard/application/processListPresenter'
import { CreateProcessDialog } from '~/modules/process'
import type { CreateProcessInput } from '~/modules/process/domain/processStuff'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { typedFetch } from '~/shared/api/typedFetch'
import {
  CreateProcessResponseSchema,
  ProcessListResponseSchema,
} from '~/shared/api-schemas/processes.schemas'
import { useTranslation } from '~/shared/localization/i18n'
import {
  AppHeader,
  EmptyState,
  ExistingProcessError,
  MetricCard,
  StatusBadge,
  type StatusVariant,
} from '~/shared/ui'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'
import { isRecord } from '~/shared/utils/typeGuards'


// Domain types for the dashboard - derived from API response
type ProcessSummary = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly containerCount: number
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly carrier: string | null
}

// Fetch processes from API
async function fetchProcesses(): Promise<readonly ProcessSummary[]> {
  const data = await typedFetch('/api/processes', undefined, ProcessListResponseSchema)
  return presentProcessList(data)
}

// Create process via API
async function createProcessApi(input: CreateProcessInput): Promise<{ id: string }> {
  const result = await typedFetch(
    '/api/processes',
    {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    },
    CreateProcessResponseSchema,
  )
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
  const { t, keys } = useTranslation()
  const navigate = useNavigate()
  const [processes, { refetch }] = createResource(fetchProcesses)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<
    | string
    | { message: string; processId?: string; containerId?: string; containerNumber?: string }
    | null
  >(null)

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

  const handleProcessSubmit = async (data: CreateProcessDialogFormData) => {
    try {
      setCreateError(null)

      // Transform UI form data to API input format
      const input: CreateProcessInput = {
        reference: data.reference || null,
        // data.operationType is already strongly typed in the form's type; pass it through
        operation_type: data.operationType || undefined,
        origin: data.origin ? { display_name: data.origin } : null,
        destination: data.destination ? { display_name: data.destination } : null,
        // carrier from the form is already typed
        carrier: data.carrier || null,
        bill_of_lading: data.billOfLading || null,
        containers: data.containers.map((c) => ({
          container_number: c.containerNumber,
          carrier_code: data.carrier || null,
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
      // Type guard for the structured API conflict payload
      if (err && typeof err === 'object') {
        const body = safeParseOrDefault(err, z.record(z.string(), z.unknown()), null)
        if (body && 'existing' in body && isRecord(body)) {
          const ex = safeParseOrDefault(body['existing'], z.record(z.string(), z.unknown()), null)
          if (ex) {
            const processId = String(ex.processId ?? ex.process_id ?? '')
            const containerId = String(ex.containerId ?? ex.container_id ?? '')
            const containerNumber = String(ex.containerNumber ?? ex.container_number ?? '')
            setCreateError({
              message: String(
                isRecord(body) && typeof body['message'] === 'string'
                  ? body['message']
                  : 'Container already exists',
              ),
              processId,
              containerId,
              containerNumber,
            })
            return
          }
        }
      }
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
          <ExistingProcessError
            message={(() => {
              const v = createError()
              if (typeof v === 'string') return v
              const body = safeParseOrDefault(v, z.record(z.string(), z.unknown()), null)
              if (body && isRecord(body) && typeof body['message'] === 'string')
                return String(body['message'])
              return ''
            })()}
            existing={(() => {
              const v = createError()
              const body = safeParseOrDefault(v, z.record(z.string(), z.unknown()), null)
              if (body) {
                return {
                  processId: String(body.processId ?? body.process_id ?? ''),
                  containerId: String(body.containerId ?? body.container_id ?? ''),
                  containerNumber: String(body.containerNumber ?? body.container_number ?? ''),
                }
              }
              return undefined
            })()}
            onAcknowledge={() => setCreateError(null)}
          />
        </Show>

        {/* Metrics Grid */}
        <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<ShipIcon />}
            label={t(keys.dashboard.metrics.activeShipments)}
            value={metrics().activeCount}
          />
          <MetricCard
            icon={<ContainerIcon />}
            label={t(keys.dashboard.metrics.inTransit)}
            value={metrics().inTransitCount}
          />
          <MetricCard
            icon={<AlertIcon />}
            label={t(keys.dashboard.metrics.delays)}
            value={metrics().delayCount}
            variant={metrics().delayCount > 0 ? 'warning' : 'default'}
          />
          <MetricCard
            icon={<CheckIcon />}
            label={t(keys.dashboard.metrics.arrivalsToday)}
            value={metrics().arrivingToday}
            variant={metrics().arrivingToday > 0 ? 'success' : 'default'}
          />
        </div>

        {/* Shipments Table */}
        <section class="rounded-lg border border-slate-200 bg-white">
          <header class="border-b border-slate-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-slate-900">{t(keys.dashboard.table.title)}</h2>
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
                  title={t(keys.dashboard.empty.title)}
                  description={t(keys.dashboard.empty.description)}
                  actionLabel={t(keys.dashboard.empty.action)}
                  onAction={handleCreateProcess}
                />
              }
            >
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th class="px-6 py-3">{t(keys.dashboard.table.col.process)}</th>
                      <th class="px-6 py-3">{t(keys.dashboard.table.col.carrier)}</th>
                      <th class="px-6 py-3">{t(keys.dashboard.table.col.client)}</th>
                      <th class="px-6 py-3">{t(keys.dashboard.table.col.route)}</th>
                      <th class="px-6 py-3 text-center">{t(keys.dashboard.table.col.containers)}</th>
                      <th class="px-6 py-3">{t(keys.dashboard.table.col.status)}</th>
                      <th class="px-6 py-3">{t(keys.dashboard.table.col.eta)}</th>
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
