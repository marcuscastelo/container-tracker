import type { JSX } from 'solid-js'
import { createEffect, For, Show } from 'solid-js'
import type {
  AgentLogLineVM,
  AgentLogsConnectionState,
} from '~/modules/agent/ui/logs/agent-logs.vm'
import type { useAgentLogsController } from '~/modules/agent/ui/logs/useAgentLogsController'

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function toLogChannel(value: string): 'stdout' | 'stderr' | 'both' {
  if (value === 'stdout') return 'stdout'
  if (value === 'stderr') return 'stderr'
  return 'both'
}

type Controller = ReturnType<typeof useAgentLogsController>

type Props = {
  readonly controller: Controller
  readonly agentStatus: string
}

type EmptyStateKind = 'none' | 'loading' | 'not_supported' | 'offline' | 'empty'

function ConnectionBadge(props: { readonly state: AgentLogsConnectionState }): JSX.Element {
  const tone = () => {
    if (props.state === 'live') {
      return 'border-tone-success-border bg-tone-success-bg text-tone-success-fg'
    }

    if (props.state === 'disconnected') {
      return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
    }

    if (props.state === 'reconnecting') {
      return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
    }

    return 'border-border bg-surface-muted text-text-muted'
  }

  return (
    <span
      class={`inline-flex items-center rounded border px-2 py-0.5 text-micro font-semibold uppercase ${tone()}`}
    >
      {props.state}
    </span>
  )
}

function LogsHeader(props: { readonly controller: Controller }): JSX.Element {
  return (
    <header class="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-md-ui font-semibold text-foreground">Runtime logs</h2>
        <ConnectionBadge state={props.controller.connectionState()} />
        <span class="text-sm-ui text-text-muted">OS: {props.controller.os() ?? '—'}</span>
        <span class="text-sm-ui text-text-muted">
          Last line: {formatDateTime(props.controller.lastLogAt())}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <select
          value={props.controller.channel()}
          onInput={(event) => props.controller.setChannel(toLogChannel(event.currentTarget.value))}
          class="rounded border border-control-border bg-control-bg px-2 py-1 text-sm-ui text-control-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="both">both</option>
          <option value="stdout">stdout</option>
          <option value="stderr">stderr</option>
        </select>

        <button
          type="button"
          onClick={() => props.controller.reconnect()}
          class="rounded border border-control-border bg-control-bg px-2 py-1 text-sm-ui text-control-foreground hover:bg-control-bg-hover"
        >
          Reconnect
        </button>

        <button
          type="button"
          onClick={() => props.controller.clearViewport()}
          class="rounded border border-control-border bg-control-bg px-2 py-1 text-sm-ui text-control-foreground hover:bg-control-bg-hover"
        >
          Clear viewport
        </button>
      </div>
    </header>
  )
}

function LogsErrorBanner(props: { readonly message: string | null }): JSX.Element {
  return (
    <Show when={props.message}>
      {(message) => (
        <div class="mx-3 mt-3 rounded border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-sm-ui text-tone-danger-fg">
          {message()}
        </div>
      )}
    </Show>
  )
}

function LogsJumpToLatest(props: { readonly controller: Controller }): JSX.Element {
  return (
    <Show when={props.controller.hasBufferedLines() && !props.controller.isAutoScrollEnabled()}>
      <div class="px-3 pt-2">
        <button
          type="button"
          onClick={() => props.controller.jumpToLatest()}
          class="rounded border border-tone-info-border bg-tone-info-bg px-2 py-1 text-sm-ui text-tone-info-fg"
        >
          Jump to latest
        </button>
      </div>
    </Show>
  )
}

function LogsEmptyState(props: { readonly kind: Exclude<EmptyStateKind, 'none'> }): JSX.Element {
  const message = () => {
    if (props.kind === 'not_supported') {
      return 'Logs not supported for this runtime yet.'
    }

    if (props.kind === 'offline') {
      return 'Agent offline or unavailable. Reconnect the agent to stream logs.'
    }

    if (props.kind === 'loading') {
      return 'Connecting log stream...'
    }

    return 'No logs yet.'
  }

  return (
    <div class="rounded border border-border bg-surface-muted px-3 py-6 text-center text-sm-ui text-text-muted">
      {message()}
    </div>
  )
}

function LogLineItem(props: { readonly line: AgentLogLineVM }): JSX.Element {
  return (
    <div class="rounded border border-border/70 bg-background px-2 py-1">
      <div class="flex flex-wrap items-center gap-2 text-micro text-text-muted">
        <span>{props.line.timestampDisplay}</span>
        <span
          class={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold ${props.line.channel === 'stderr' ? 'bg-tone-danger-bg text-tone-danger-fg' : 'bg-tone-info-bg text-tone-info-fg'}`}
        >
          {props.line.channelLabel}
        </span>
        <span>#{props.line.sequence}</span>
        <Show when={props.line.truncated}>
          <span class="text-tone-warning-fg">truncated</span>
        </Show>
      </div>
      <pre class="whitespace-pre-wrap break-words">{props.line.message}</pre>
    </div>
  )
}

function LogLinesList(props: { readonly lines: readonly AgentLogLineVM[] }): JSX.Element {
  return (
    <div class="space-y-1 font-mono text-micro leading-5 text-foreground">
      <For each={props.lines}>{(line) => <LogLineItem line={line} />}</For>
    </div>
  )
}

function resolveEmptyState(state: {
  readonly hasLines: boolean
  readonly isLoading: boolean
  readonly logsSupported: boolean
  readonly agentStatus: string
}): EmptyStateKind {
  if (state.hasLines) return 'none'
  if (state.isLoading) return 'loading'
  if (!state.logsSupported) return 'not_supported'
  if (state.agentStatus === 'Disconnected') return 'offline'
  return 'empty'
}

function toRenderableEmptyState(kind: EmptyStateKind): Exclude<EmptyStateKind, 'none'> {
  if (kind === 'none') return 'empty'
  return kind
}

export function AgentLogsPanelView(props: Props): JSX.Element {
  let viewportRef: HTMLDivElement | undefined

  const isNearBottom = (): boolean => {
    const viewport = viewportRef
    if (!viewport) return true
    const gap = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    return gap <= 12
  }

  const onScroll = (): void => {
    const nearBottom = isNearBottom()
    props.controller.setIsAutoScrollEnabled(nearBottom)
    if (nearBottom) {
      props.controller.jumpToLatest()
    }
  }

  createEffect(() => {
    props.controller.lines()
    if (!props.controller.isAutoScrollEnabled()) return

    const viewport = viewportRef
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  })

  const emptyState = () =>
    resolveEmptyState({
      hasLines: props.controller.lines().length > 0,
      isLoading: props.controller.isLoading(),
      logsSupported: props.controller.logsSupported(),
      agentStatus: props.agentStatus,
    })

  return (
    <section class="rounded-lg border border-border bg-surface">
      <LogsHeader controller={props.controller} />
      <LogsErrorBanner message={props.controller.errorMessage()} />
      <LogsJumpToLatest controller={props.controller} />

      <div
        ref={(element) => {
          viewportRef = element
        }}
        onScroll={onScroll}
        class="max-h-[32rem] overflow-y-auto p-3"
      >
        <Show
          when={emptyState() === 'none'}
          fallback={<LogsEmptyState kind={toRenderableEmptyState(emptyState())} />}
        >
          <LogLinesList lines={props.controller.lines()} />
        </Show>
      </div>

      <footer class="flex items-center justify-between border-t border-border px-3 py-2 text-micro text-text-muted">
        <span>Visible lines: {props.controller.lines().length}</span>
        <span>Viewport cap: 2000</span>
      </footer>
    </section>
  )
}
