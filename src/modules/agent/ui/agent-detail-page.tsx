import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Index,
  onCleanup,
  Show,
} from 'solid-js'
import {
  fetchAgentDetail,
  requestAgentRestart,
  requestAgentUpdate,
} from '~/modules/agent/ui/api/agent.api'
import { AgentCapabilitiesCard } from '~/modules/agent/ui/components/AgentCapabilitiesCard'
import { AgentDiagnosticsCard } from '~/modules/agent/ui/components/AgentDiagnosticsCard'
import { AgentEnrollmentCard } from '~/modules/agent/ui/components/AgentEnrollmentCard'
import { AgentHealthCard } from '~/modules/agent/ui/components/AgentHealthCard'
import { AgentIdentityCard } from '~/modules/agent/ui/components/AgentIdentityCard'
import { AgentMetricsCard } from '~/modules/agent/ui/components/AgentMetricsCard'
import { AgentRecentActivityCard } from '~/modules/agent/ui/components/AgentRecentActivityCard'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import { toAgentDetailVM } from '~/modules/agent/ui/mappers/agent.ui-mapper'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'
import {
  subscribeToTrackingAgentActivityByAgentId,
  subscribeToTrackingAgentsByTenant,
} from '~/shared/api/agent-monitoring.realtime.client'
import { AppHeader } from '~/shared/ui/AppHeader'

type Props = {
  readonly agentId: string
}

function DetailSkeleton(): JSX.Element {
  return (
    <div class="grid gap-4 lg:grid-cols-2">
      <Index each={new Array(6)}>
        {() => (
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="mb-3 h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div class="space-y-2">
              <div class="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div class="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
              <div class="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        )}
      </Index>
    </div>
  )
}

function DetailError(props: { readonly onRetry: () => void }): JSX.Element {
  return (
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <svg
          class="h-6 w-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p class="text-sm-ui text-red-600">Failed to load agent details</p>
      <button
        type="button"
        onClick={() => props.onRetry()}
        class="mt-3 text-sm-ui font-medium text-slate-700 underline hover:text-slate-900"
      >
        Retry
      </button>
    </div>
  )
}

function AgentNotFound(): JSX.Element {
  return (
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <p class="text-md-ui text-slate-600">Agent not found</p>
      <A href="/agents" class="mt-3 text-sm-ui font-medium text-sky-600 hover:text-sky-500">
        Back to agents
      </A>
    </div>
  )
}

type AgentDetailToolbarProps = {
  readonly vm: () => AgentDetailVM | null
  readonly onBack: () => void
  readonly onRefresh: () => void
  readonly onRequestUpdate: () => Promise<void>
  readonly onRequestRestart: () => Promise<void>
  readonly lastRefreshed: () => Date
}

function AgentDetailToolbar(props: AgentDetailToolbarProps): JSX.Element {
  return (
    <section class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          onClick={() => props.onBack()}
          class="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm-ui font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Agents
        </button>

        <Show when={props.vm()}>
          {(currentVM) => (
            <div class="flex items-center gap-2">
              <h1 class="text-lg-ui font-semibold text-slate-900">{currentVM().hostname}</h1>
              <AgentStatusBadge label={currentVM().status} tone={currentVM().statusTone} />
              <span class="text-sm-ui text-slate-500">{currentVM().tenantName}</span>
            </div>
          )}
        </Show>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void props.onRequestUpdate()}
          class="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-sm-ui font-medium text-sky-700 transition-colors hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          Request update
        </button>
        <button
          type="button"
          onClick={() => void props.onRequestRestart()}
          class="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm-ui font-medium text-amber-700 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
        >
          Request restart
        </button>
        <span class="text-micro text-slate-400">
          Updated {formatRefreshTime(props.lastRefreshed())}
        </span>
        <button
          type="button"
          onClick={() => props.onRefresh()}
          class="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-sm-ui font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>
    </section>
  )
}

function formatRefreshTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function extractRealtimeRowId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const idValue = Reflect.get(value, 'id')
  return typeof idValue === 'string' ? idValue : null
}

export function AgentDetailPage(props: Props): JSX.Element {
  const navigate = useNavigate()
  const [detail, { refetch }] = createResource(() => props.agentId, fetchAgentDetail)
  const [lastRefreshed, setLastRefreshed] = createSignal(new Date())
  const [actionMessage, setActionMessage] = createSignal<string | null>(null)
  const [actionError, setActionError] = createSignal<string | null>(null)

  const fallbackPollTimer = setInterval(() => {
    setLastRefreshed(new Date())
    void refetch()
  }, 20_000)

  onCleanup(() => clearInterval(fallbackPollTimer))

  createEffect(() => {
    try {
      const subscription = subscribeToTrackingAgentActivityByAgentId({
        agentId: props.agentId,
        onEvent() {
          setLastRefreshed(new Date())
          void refetch()
        },
      })

      onCleanup(() => subscription.unsubscribe())
    } catch (error) {
      console.warn('[agents] unable to subscribe to agent activity realtime', error)
    }
  })

  createEffect(() => {
    const tenantId = detail()?.tenantId
    if (!tenantId) return

    const subscription = subscribeToTrackingAgentsByTenant({
      tenantId,
      onEvent(event) {
        if (event.table !== 'tracking_agents') return
        const rowId = extractRealtimeRowId(event.row)
        const oldRowId = extractRealtimeRowId(event.oldRow)
        if (rowId !== props.agentId && oldRowId !== props.agentId) return

        setLastRefreshed(new Date())
        void refetch()
      },
    })

    onCleanup(() => subscription.unsubscribe())
  })

  const now = createMemo(() => lastRefreshed())
  const vm = createMemo(() => {
    const dto = detail()
    if (!dto) return null
    return toAgentDetailVM(dto, now())
  })

  function handleRefresh(): void {
    setLastRefreshed(new Date())
    void refetch()
  }

  function handleBack(): void {
    void navigate('/agents')
  }

  async function handleRequestUpdate(): Promise<void> {
    const versionInput =
      typeof globalThis.prompt === 'function' ? globalThis.prompt('Desired version to apply') : null
    if (!versionInput || versionInput.trim().length === 0) {
      return
    }

    setActionError(null)
    setActionMessage(null)

    try {
      const response = await requestAgentUpdate({
        agentId: props.agentId,
        desiredVersion: versionInput.trim(),
      })
      setActionMessage(`Update requested at ${response.requestedAt}`)
      setLastRefreshed(new Date())
      await refetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setActionError(message)
    }
  }

  async function handleRequestRestart(): Promise<void> {
    setActionError(null)
    setActionMessage(null)

    try {
      const response = await requestAgentRestart({
        agentId: props.agentId,
      })
      setActionMessage(`Restart requested at ${response.requestedAt}`)
      setLastRefreshed(new Date())
      await refetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setActionError(message)
    }
  }

  return (
    <div class="relative min-h-screen bg-slate-50/80">
      <div class="relative z-10">
        <AppHeader />

        <main class="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <AgentDetailToolbar
            vm={vm}
            onBack={handleBack}
            onRefresh={handleRefresh}
            onRequestUpdate={handleRequestUpdate}
            onRequestRestart={handleRequestRestart}
            lastRefreshed={lastRefreshed}
          />

          <Show when={actionMessage()}>
            {(message) => (
              <div class="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm-ui text-emerald-700">
                {message()}
              </div>
            )}
          </Show>

          <Show when={actionError()}>
            {(message) => (
              <div class="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm-ui text-red-700">
                {message()}
              </div>
            )}
          </Show>

          <Show when={detail.loading}>
            <DetailSkeleton />
          </Show>

          <Show when={!detail.loading && detail.error}>
            <DetailError onRetry={handleRefresh} />
          </Show>

          <Show when={!detail.loading && !detail.error && !detail()}>
            <AgentNotFound />
          </Show>

          <Show when={!detail.loading && !detail.error && vm()}>
            {(currentVM) => (
              <div class="grid gap-4 lg:grid-cols-2">
                <AgentIdentityCard vm={currentVM()} />
                <AgentHealthCard vm={currentVM()} />
                <AgentMetricsCard vm={currentVM()} />
                <AgentEnrollmentCard vm={currentVM()} />
                <AgentCapabilitiesCard vm={currentVM()} />
                <AgentDiagnosticsCard vm={currentVM()} />
                <div class="lg:col-span-2">
                  <AgentRecentActivityCard activities={currentVM().recentActivity} />
                </div>
              </div>
            )}
          </Show>
        </main>
      </div>
    </div>
  )
}
