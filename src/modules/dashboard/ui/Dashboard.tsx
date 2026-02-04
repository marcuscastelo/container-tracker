import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { useTranslation } from '../../../i18n'
import {
  AppHeader,
  EmptyState,
  MetricCard,
  StatusBadge,
  type StatusVariant,
} from '../../../shared/ui'

const keys = {
  pageTitle: 'dashboard.pageTitle',
  activeShipments: 'dashboard.metrics.activeShipments',
  inTransit: 'dashboard.metrics.inTransit',
  delays: 'dashboard.metrics.delays',
  arrivalsToday: 'dashboard.metrics.arrivalsToday',
  tableTitle: 'dashboard.table.title',
  colProcess: 'dashboard.table.col.process',
  colRoute: 'dashboard.table.col.route',
  colContainers: 'dashboard.table.col.containers',
  colStatus: 'dashboard.table.col.status',
  colEta: 'dashboard.table.col.eta',
  emptyTitle: 'dashboard.empty.title',
  emptyDescription: 'dashboard.empty.description',
  emptyAction: 'dashboard.empty.action',
}

// Domain types for the dashboard
type ShipmentSummary = {
  readonly id: string
  readonly processRef: string
  readonly origin: string
  readonly destination: string
  readonly containerCount: number
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
}

// Sample data for demonstration
const sampleShipments: readonly ShipmentSummary[] = [
  {
    id: '1',
    processRef: '2024-0458',
    origin: 'Shanghai',
    destination: 'Santos',
    containerCount: 2,
    status: 'in-transit',
    statusLabel: 'Em Trânsito',
    eta: '10/05/2024',
  },
  {
    id: '2',
    processRef: '2024-0321',
    origin: 'Hamburg',
    destination: 'Rio de Janeiro',
    containerCount: 1,
    status: 'delayed',
    statusLabel: 'Chegada Atrasada',
    eta: '07/05/2024',
  },
  {
    id: '3',
    processRef: '2024-0297',
    origin: 'Los Angeles',
    destination: 'Paranaguá',
    containerCount: 3,
    status: 'loaded',
    statusLabel: 'Carregado no Navio',
    eta: '12/05/2024',
  },
  {
    id: '4',
    processRef: '2024-0510',
    origin: 'Ningbo',
    destination: 'Itajaí',
    containerCount: 1,
    status: 'customs',
    statusLabel: 'Despacho Aduaneiro',
    eta: '05/05/2024',
  },
  {
    id: '5',
    processRef: '2024-0387',
    origin: 'Busan',
    destination: 'Navegantes',
    containerCount: 2,
    status: 'released',
    statusLabel: 'Liberado para Retirada',
    eta: '04/05/2024',
  },
]

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
  const [shipments] = createSignal<readonly ShipmentSummary[]>(sampleShipments)

  const metrics = () => {
    const data = shipments()
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
    // TODO: Navigate to create process flow
    console.log('Create process clicked')
  }

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader onCreateProcess={handleCreateProcess} />

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

          <Show
            when={shipments().length > 0}
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
                    <th class="px-6 py-3">{t(keys.colRoute)}</th>
                    <th class="px-6 py-3 text-center">{t(keys.colContainers)}</th>
                    <th class="px-6 py-3">{t(keys.colStatus)}</th>
                    <th class="px-6 py-3">{t(keys.colEta)}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <For each={shipments()}>
                    {(shipment) => (
                      <tr class="transition-colors hover:bg-slate-50">
                        <td class="px-6 py-4">
                          <A
                            href={`/shipments/${shipment.id}`}
                            class="font-medium text-slate-900 hover:text-slate-700 hover:underline"
                          >
                            {shipment.processRef}
                          </A>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center gap-2 text-sm text-slate-600">
                            <span>{shipment.origin}</span>
                            <ArrowIcon />
                            <span>{shipment.destination}</span>
                          </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-700">
                            {shipment.containerCount}
                          </span>
                        </td>
                        <td class="px-6 py-4">
                          <StatusBadge variant={shipment.status} label={shipment.statusLabel} />
                        </td>
                        <td class="px-6 py-4 text-sm text-slate-600">
                          <Show
                            when={shipment.eta}
                            fallback={<span class="text-slate-400">—</span>}
                          >
                            {shipment.eta}
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </section>
      </main>
    </div>
  )
}
