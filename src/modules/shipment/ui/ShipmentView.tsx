import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { useTranslation } from '../../../i18n'
import { AppHeader, StatusBadge, type StatusVariant } from '../../../shared/ui'

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
  etaMissing: 'shipmentView.etaMissing',
}

// Domain types
type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

type TimelineEvent = {
  readonly id: string
  readonly label: string
  readonly location?: string
  readonly date: string | null
  readonly expectedDate?: string | null
  readonly status: EventStatus
}

type Alert = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'info'
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
}

type ShipmentDetail = {
  readonly id: string
  readonly processRef: string
  readonly origin: string
  readonly destination: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly containers: readonly ContainerDetail[]
  readonly alerts: readonly Alert[]
}

// Sample data
const sampleShipment: ShipmentDetail = {
  id: '2',
  processRef: '2024-0321',
  origin: 'Hamburg',
  destination: 'Rio de Janeiro',
  status: 'delayed',
  statusLabel: 'Chegada Atrasada',
  eta: '07/05/2024',
  containers: [
    {
      id: 'c1',
      number: 'MEDU9876543',
      status: 'delayed',
      statusLabel: 'Chegada Atrasada',
      eta: '07/05/2024',
      timeline: [
        {
          id: 'e1',
          label: 'Booking Confirmed',
          location: 'Hamburg',
          date: '15/04/2024',
          status: 'completed',
        },
        {
          id: 'e2',
          label: 'Gate In',
          location: 'Hamburg Terminal',
          date: '18/04/2024',
          status: 'completed',
        },
        {
          id: 'e3',
          label: 'Loaded on Vessel',
          location: 'MSC Tina',
          date: '20/04/2024',
          status: 'completed',
        },
        {
          id: 'e4',
          label: 'Delay in Transit',
          location: 'Atlantic Ocean',
          date: null,
          expectedDate: '28/04/2024',
          status: 'delayed',
        },
        {
          id: 'e5',
          label: 'Arrival at POD',
          location: 'Rio de Janeiro',
          date: null,
          expectedDate: '07/05/2024',
          status: 'expected',
        },
        {
          id: 'e6',
          label: 'Final Delivery',
          location: undefined,
          date: null,
          expectedDate: undefined,
          status: 'expected',
        },
      ],
    },
    {
      id: 'c2',
      number: 'MRKU1234567',
      status: 'in-transit',
      statusLabel: 'Em Trânsito',
      eta: '09/05/2024',
      timeline: [
        {
          id: 'e1',
          label: 'Booking Confirmed',
          location: 'Hamburg',
          date: '16/04/2024',
          status: 'completed',
        },
        {
          id: 'e2',
          label: 'Gate In',
          location: 'Hamburg Terminal',
          date: '19/04/2024',
          status: 'completed',
        },
        {
          id: 'e3',
          label: 'Loaded on Vessel',
          location: 'MSC Tina',
          date: '20/04/2024',
          status: 'completed',
        },
        {
          id: 'e4',
          label: 'In Transit',
          location: 'Atlantic Ocean',
          date: null,
          status: 'current',
        },
        {
          id: 'e5',
          label: 'Arrival at POD',
          location: 'Rio de Janeiro',
          date: null,
          expectedDate: '09/05/2024',
          status: 'expected',
        },
        {
          id: 'e6',
          label: 'Final Delivery',
          location: undefined,
          date: null,
          expectedDate: undefined,
          status: 'expected',
        },
      ],
    },
  ],
  alerts: [
    {
      id: 'a1',
      type: 'delay',
      message: 'Navio MSC Tina - Chegada atrasada em 2 dias devido a condições climáticas.',
      timestamp: 'Há 2 horas',
    },
    {
      id: 'a2',
      type: 'info',
      message: 'Container MRKU1234567 - Documentação liberada.',
      timestamp: 'Hoje 08:30',
    },
  ],
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

function AlertIcon(props: { readonly type: Alert['type'] }): JSX.Element {
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

  // In a real app, this would fetch shipment by params.id using useParams()
  const [shipment] = createSignal<ShipmentDetail>(sampleShipment)
  const [selectedContainerId, setSelectedContainerId] = createSignal<string>(
    sampleShipment.containers[0]?.id ?? '',
  )

  const selectedContainer = createMemo(() => {
    return (
      shipment().containers.find((c) => c.id === selectedContainerId()) ?? shipment().containers[0]
    )
  })

  return (
    <div class="min-h-screen bg-slate-50">
      <AppHeader />

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back link */}
        <A
          href="/"
          class="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeftIcon />
          {t(keys.backToList)}
        </A>

        {/* Shipment Header Card */}
        <section class="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 class="text-xl font-semibold text-slate-900">
                {t(keys.shipmentHeader)} {shipment().processRef}
              </h1>
              <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <span>{shipment().origin}</span>
                <ArrowIcon />
                <span>{shipment().destination}</span>
              </div>
            </div>
            <div class="flex items-center gap-6">
              <div class="text-right">
                <p class="text-xs uppercase text-slate-500">{t(keys.status)}</p>
                <StatusBadge variant={shipment().status} label={shipment().statusLabel} />
              </div>
              <div class="text-right">
                <p class="text-xs uppercase text-slate-500">{t(keys.eta)}</p>
                <p class="text-sm font-medium text-slate-900">
                  {shipment().eta ?? t(keys.etaMissing)}
                </p>
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
                  {t(keys.containersTitle)} ({shipment().containers.length})
                </h2>
              </header>
              <div class="p-4">
                <div class="flex flex-wrap gap-2">
                  <For each={shipment().containers}>
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
                <h2 class="text-base font-semibold text-slate-900">{t(keys.timelineTitle)}</h2>
                <p class="mt-1 text-xs text-slate-500">
                  {selectedContainer()?.number} •{' '}
                  <StatusBadge
                    variant={selectedContainer()?.status ?? 'unknown'}
                    label={selectedContainer()?.statusLabel ?? ''}
                  />
                </p>
              </header>
              <div class="p-6">
                <Show when={selectedContainer()}>
                  {(container) => (
                    <div>
                      <For each={container().timeline}>
                        {(event, index) => (
                          <TimelineNode
                            event={event}
                            isLast={index() === container().timeline.length - 1}
                          />
                        )}
                      </For>
                    </div>
                  )}
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
                  when={shipment().alerts.length > 0}
                  fallback={
                    <p class="py-4 text-center text-sm text-slate-500">{t(keys.alertsEmpty)}</p>
                  }
                >
                  <ul class="space-y-3">
                    <For each={shipment().alerts}>
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
      </main>
    </div>
  )
}
