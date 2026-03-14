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
import { AgentLogsPanelView } from '~/modules/agent/ui/components/AgentLogsPanelView'
import { AgentMetricsCard } from '~/modules/agent/ui/components/AgentMetricsCard'
import { AgentRecentActivityCard } from '~/modules/agent/ui/components/AgentRecentActivityCard'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import { useAgentLogsController } from '~/modules/agent/ui/logs/useAgentLogsController'
import { toAgentDetailVM } from '~/modules/agent/ui/mappers/agent.ui-mapper'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'
import {
  subscribeToTrackingAgentActivityByAgentId,
  subscribeToTrackingAgentsByTenant,
} from '~/shared/api/agent-monitoring.realtime.client'
import { AppHeader } from '~/shared/ui/AppHeader'

type Props = {
  readonly agentId: string
  readonly initialOpenLogs?: boolean
}

function DetailSkeleton(): JSX.Element {
  return (
    <div class="grid gap-4 lg:grid-cols-2">
      <Index each={new Array(6)}>
        {() => (
          <div class="rounded-lg border border-border bg-surface p-4">
            <div class="mb-3 h-3 w-24 animate-pulse rounded bg-surface-muted" />
            <div class="space-y-2">
              <div class="h-4 w-full animate-pulse rounded bg-surface-muted" />
              <div class="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
              <div class="h-4 w-1/2 animate-pulse rounded bg-surface-muted" />
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
      <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-tone-danger-bg">
        <svg
          class="h-6 w-6 text-tone-danger-strong"
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
      <p class="text-sm-ui text-tone-danger-fg">Failed to load agent details</p>
      <button
        type="button"
        onClick={() => props.onRetry()}
        class="mt-3 text-sm-ui font-medium text-control-foreground underline hover:text-control-foreground-strong"
      >
        Retry
      </button>
    </div>
  )
}

function AgentNotFound(): JSX.Element {
  return (
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <p class="text-md-ui text-text-muted">Agent not found</p>
      <A href="/agents" class="mt-3 text-sm-ui font-medium text-primary hover:text-primary-hover">
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
  readonly showLogs: () => boolean
  readonly onToggleLogs: () => void
  readonly lastRefreshed: () => Date
}

function AgentDetailToolbar(props: AgentDetailToolbarProps): JSX.Element {
  return (
    <section class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          onClick={() => props.onBack()}
          class="inline-flex items-center gap-1 rounded border border-control-border bg-control-bg px-2 py-1 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
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
              <h1 class="text-lg-ui font-semibold text-foreground">{currentVM().hostname}</h1>
              <AgentStatusBadge label={currentVM().status} tone={currentVM().statusTone} />
              <span class="text-sm-ui text-text-muted">{currentVM().tenantName}</span>
            </div>
          )}
        </Show>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void props.onRequestUpdate()}
          class="inline-flex items-center rounded border border-tone-info-border bg-tone-info-bg px-2.5 py-1 text-sm-ui font-medium text-tone-info-fg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-tone-info-border/50"
        >
          Request update
        </button>
        <button
          type="button"
          onClick={() => void props.onRequestRestart()}
          class="inline-flex items-center rounded border border-tone-warning-border bg-tone-warning-bg px-2.5 py-1 text-sm-ui font-medium text-tone-warning-fg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-tone-warning-border/50"
        >
          Request restart
        </button>
        <button
          type="button"
          onClick={() => props.onToggleLogs()}
          class="inline-flex items-center rounded border border-control-border bg-control-bg px-2.5 py-1 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          {props.showLogs() ? 'Hide logs' : 'View logs'}
        </button>
        <span class="text-micro text-text-muted">
          Updated {formatRefreshTime(props.lastRefreshed())}
        </span>
        <button
          type="button"
          onClick={() => props.onRefresh()}
          class="inline-flex items-center gap-1.5 rounded border border-control-border bg-control-bg px-2.5 py-1 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
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
  const logsController = useAgentLogsController({
    agentId: props.agentId,
  })
  const [detail, { refetch }] = createResource(() => props.agentId, fetchAgentDetail)
  const [lastRefreshed, setLastRefreshed] = createSignal(new Date())
  const [actionMessage, setActionMessage] = createSignal<string | null>(null)
  const [actionError, setActionError] = createSignal<string | null>(null)
  const [showLogs, setShowLogs] = createSignal(props.initialOpenLogs ?? false)

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
    <div class="relative min-h-screen bg-dashboard-canvas">
      <div class="relative z-10">
        <AppHeader />

        <main class="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <AgentDetailToolbar
            vm={vm}
            onBack={handleBack}
            onRefresh={handleRefresh}
            onRequestUpdate={handleRequestUpdate}
            onRequestRestart={handleRequestRestart}
            showLogs={showLogs}
            onToggleLogs={() => setShowLogs((current) => !current)}
            lastRefreshed={lastRefreshed}
          />

          <Show when={actionMessage()}>
            {(message) => (
              <div class="mb-3 rounded border border-tone-success-border bg-tone-success-bg px-3 py-2 text-sm-ui text-tone-success-fg">
                {message()}
              </div>
            )}
          </Show>

          <Show when={actionError()}>
            {(message) => (
              <div class="mb-3 rounded border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-sm-ui text-tone-danger-fg">
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
                <Show when={showLogs()}>
                  <div class="lg:col-span-2">
                    <AgentLogsPanelView
                      controller={logsController}
                      agentStatus={currentVM().status}
                    />
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </main>
      </div>
    </div>
  )
}
