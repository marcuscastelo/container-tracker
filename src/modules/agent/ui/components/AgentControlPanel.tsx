import { createEffect, createResource, createSignal, For, type JSX, Show } from 'solid-js'
import {
  type AgentControlStatePayload,
  fetchAgentControlState,
  requestAgentReset,
  requestAgentRestart,
  requestAgentUpdate,
  updateAgentRemotePolicy,
} from '~/modules/agent/ui/api/agent.api'

type AgentControlPanelProps = {
  readonly agentId: string
  readonly onAfterAction: () => Promise<void> | void
  readonly onActionMessage: (message: string) => void
  readonly onActionError: (message: string | null) => void
}

type PendingCommand = AgentControlStatePayload['commands'][number]

type ActionExecutionCommand = {
  readonly label: string
  readonly action: (reason: string) => Promise<{ readonly requestedAt: string }>
  readonly successMessage: (requestedAt: string) => string
  readonly confirmation?: string
}

type AgentControlPanelController = {
  readonly controlState: () => AgentControlStatePayload | null | undefined
  readonly loading: () => boolean
  readonly hasError: () => boolean
  readonly busyAction: () => string | null
  readonly reasonDraft: () => string
  readonly desiredVersionDraft: () => string
  readonly channelDraft: () => string
  readonly blockedVersionsDraft: () => string
  readonly canRunActions: () => boolean
  readonly setReasonDraft: (value: string) => void
  readonly setDesiredVersionDraft: (value: string) => void
  readonly setChannelDraft: (value: string) => void
  readonly setBlockedVersionsDraft: (value: string) => void
  readonly handleRequestUpdate: () => Promise<void>
  readonly handleRequestRestart: () => Promise<void>
  readonly handleRequestReset: () => Promise<void>
  readonly handlePauseUpdates: () => Promise<void>
  readonly handleResumeUpdates: () => Promise<void>
  readonly handleApplyChannel: () => Promise<void>
  readonly handleSaveBlockedVersions: () => Promise<void>
  readonly handleClearDesiredVersion: () => Promise<void>
}

export function resolveRemoteControlStateView(command: {
  readonly hasError: boolean
  readonly controlState: AgentControlStatePayload | null | undefined
}): 'error' | 'empty' | 'ready' {
  if (command.hasError) {
    return 'error'
  }

  if (!command.controlState) {
    return 'empty'
  }

  return 'ready'
}

function formatDateTime(value: string | null): string {
  if (!value) return 'none'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatPolicyArray(values: readonly string[]): string {
  return values.length === 0 ? 'none' : values.join(', ')
}

function PendingCommandItem(props: { readonly command: PendingCommand }): JSX.Element {
  return (
    <div class="rounded border border-border bg-surface p-2 text-sm-ui">
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium text-foreground">{props.command.type}</span>
        <span class="text-text-muted">{formatDateTime(props.command.requestedAt)}</span>
      </div>
      <p class="mt-1 text-xs-ui text-text-muted">Command ID: {props.command.id}</p>
    </div>
  )
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function parseBlockedVersionsDraft(value: string): string[] {
  const parsed = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  return [...new Set(parsed)]
}

function Section(props: { readonly title: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <section class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm-ui font-semibold text-foreground">{props.title}</h3>
      <div class="mt-3 space-y-3">{props.children}</div>
    </section>
  )
}

function KeyValue(props: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div class="flex items-center justify-between gap-3 text-sm-ui">
      <span class="text-text-muted">{props.label}</span>
      <span class="font-medium text-foreground">{props.value}</span>
    </div>
  )
}

function PolicySummaryCard(props: {
  readonly policy: AgentControlStatePayload['policy']
}): JSX.Element {
  return (
    <div class="rounded border border-border bg-dashboard-canvas p-3">
      <h4 class="text-xs-ui font-semibold uppercase tracking-wide text-text-muted">
        Effective Remote Policy
      </h4>
      <div class="mt-2 space-y-1.5">
        <KeyValue label="Desired version" value={props.policy.desiredVersion ?? 'none'} />
        <KeyValue label="Update channel" value={props.policy.updateChannel ?? 'none'} />
        <KeyValue label="Updates paused" value={props.policy.updatesPaused ? 'true' : 'false'} />
        <KeyValue
          label="Blocked versions"
          value={formatPolicyArray(props.policy.blockedVersions)}
        />
        <KeyValue
          label="Restart requested"
          value={formatDateTime(props.policy.restartRequestedAt)}
        />
      </div>
    </div>
  )
}

function PendingCommandsCard(props: { readonly commands: readonly PendingCommand[] }): JSX.Element {
  return (
    <div class="rounded border border-border bg-dashboard-canvas p-3">
      <h4 class="text-xs-ui font-semibold uppercase tracking-wide text-text-muted">
        Pending Commands
      </h4>
      <Show
        when={props.commands.length > 0}
        fallback={<p class="mt-2 text-sm-ui text-text-muted">No pending commands.</p>}
      >
        <div class="mt-2 space-y-2">
          <For each={props.commands}>{(command) => <PendingCommandItem command={command} />}</For>
        </div>
      </Show>
    </div>
  )
}

function ReasonInput(props: {
  readonly value: string
  readonly onInput: (value: string) => void
}): JSX.Element {
  return (
    <label class="block space-y-1">
      <span class="text-sm-ui font-medium text-foreground">Reason (required)</span>
      <textarea
        rows="2"
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        placeholder="Explain why this control change is needed"
        class="w-full rounded border border-control-border bg-control-bg px-3 py-2 text-sm-ui text-control-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  )
}

function UpdatesActionsCard(props: {
  readonly desiredVersion: string
  readonly channel: string
  readonly canRunActions: boolean
  readonly onDesiredVersionInput: (value: string) => void
  readonly onChannelInput: (value: string) => void
  readonly onForceUpdate: () => Promise<void>
  readonly onClearForcedTarget: () => Promise<void>
}): JSX.Element {
  return (
    <div class="space-y-2 rounded border border-border bg-dashboard-canvas p-3">
      <h4 class="text-sm-ui font-semibold text-foreground">Updates</h4>
      <label class="block space-y-1">
        <span class="text-xs-ui text-text-muted">Desired version</span>
        <input
          type="text"
          value={props.desiredVersion}
          onInput={(event) => props.onDesiredVersionInput(event.currentTarget.value)}
          placeholder="e.g. 1.2.3"
          class="w-full rounded border border-control-border bg-control-bg px-2 py-1.5 text-sm-ui text-control-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs-ui text-text-muted">Channel</span>
        <input
          type="text"
          value={props.channel}
          onInput={(event) => props.onChannelInput(event.currentTarget.value)}
          placeholder="stable | canary | dev"
          class="w-full rounded border border-control-border bg-control-bg px-2 py-1.5 text-sm-ui text-control-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-tone-info-border bg-tone-info-bg px-2.5 py-1 text-sm-ui font-medium text-tone-info-fg disabled:opacity-60"
          disabled={!props.canRunActions}
          onClick={() => void props.onForceUpdate()}
        >
          Force update
        </button>
        <button
          type="button"
          class="rounded border border-control-border bg-control-bg px-2.5 py-1 text-sm-ui font-medium text-control-foreground disabled:opacity-60"
          disabled={!props.canRunActions}
          onClick={() => void props.onClearForcedTarget()}
        >
          Clear forced target
        </button>
      </div>
    </div>
  )
}

function PolicyActionsCard(props: {
  readonly blockedVersions: string
  readonly canRunActions: boolean
  readonly onBlockedVersionsInput: (value: string) => void
  readonly onPauseUpdates: () => Promise<void>
  readonly onResumeUpdates: () => Promise<void>
  readonly onApplyChannel: () => Promise<void>
  readonly onSaveBlockedVersions: () => Promise<void>
}): JSX.Element {
  return (
    <div class="space-y-2 rounded border border-border bg-dashboard-canvas p-3">
      <h4 class="text-sm-ui font-semibold text-foreground">Policy</h4>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-tone-warning-border bg-tone-warning-bg px-2.5 py-1 text-sm-ui font-medium text-tone-warning-fg disabled:opacity-60"
          disabled={!props.canRunActions}
          onClick={() => void props.onPauseUpdates()}
        >
          Pause updates
        </button>
        <button
          type="button"
          class="rounded border border-tone-success-border bg-tone-success-bg px-2.5 py-1 text-sm-ui font-medium text-tone-success-fg disabled:opacity-60"
          disabled={!props.canRunActions}
          onClick={() => void props.onResumeUpdates()}
        >
          Resume updates
        </button>
        <button
          type="button"
          class="rounded border border-control-border bg-control-bg px-2.5 py-1 text-sm-ui font-medium text-control-foreground disabled:opacity-60"
          disabled={!props.canRunActions}
          onClick={() => void props.onApplyChannel()}
        >
          Apply channel
        </button>
      </div>
      <label class="block space-y-1">
        <span class="text-xs-ui text-text-muted">Blocked versions (one per line)</span>
        <textarea
          rows="4"
          value={props.blockedVersions}
          onInput={(event) => props.onBlockedVersionsInput(event.currentTarget.value)}
          class="w-full rounded border border-control-border bg-control-bg px-2 py-1.5 text-sm-ui text-control-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </label>
      <button
        type="button"
        class="rounded border border-control-border bg-control-bg px-2.5 py-1 text-sm-ui font-medium text-control-foreground disabled:opacity-60"
        disabled={!props.canRunActions}
        onClick={() => void props.onSaveBlockedVersions()}
      >
        Save blocked versions
      </button>
    </div>
  )
}

function DangerActionsRow(props: {
  readonly canRunActions: boolean
  readonly onRequestRestart: () => Promise<void>
  readonly onRequestReset: () => Promise<void>
}): JSX.Element {
  return (
    <div class="flex flex-wrap gap-2 rounded border border-border bg-dashboard-canvas p-3">
      <button
        type="button"
        class="rounded border border-tone-warning-border bg-tone-warning-bg px-2.5 py-1 text-sm-ui font-medium text-tone-warning-fg disabled:opacity-60"
        disabled={!props.canRunActions}
        onClick={() => void props.onRequestRestart()}
      >
        Request restart
      </button>
      <button
        type="button"
        class="rounded border border-tone-danger-border bg-tone-danger-bg px-2.5 py-1 text-sm-ui font-medium text-tone-danger-fg disabled:opacity-60"
        disabled={!props.canRunActions}
        onClick={() => void props.onRequestReset()}
      >
        Request reset
      </button>
    </div>
  )
}

function LocalOnlyCapabilities(): JSX.Element {
  const localOnlyItems = [
    'Backend URL switch',
    'Editable local runtime config',
    'Activate release',
    'Rollback release',
    'Start/Stop runtime service',
    'Execute local reset',
  ] as const

  return (
    <div class="space-y-2">
      <p class="text-sm-ui text-text-muted">
        These controls are local-only and must be executed from the host Agent Control UI.
      </p>
      <div class="space-y-1">
        <For each={localOnlyItems}>
          {(item) => (
            <div class="flex items-center justify-between rounded border border-border bg-dashboard-canvas px-2 py-1.5 text-sm-ui">
              <span class="text-foreground">{item}</span>
              <span class="rounded bg-tone-warning-bg px-2 py-0.5 text-xs-ui font-semibold text-tone-warning-fg">
                local-only
              </span>
            </div>
          )}
        </For>
      </div>
      <p class="text-xs-ui text-text-muted">
        Use the local Agent Control UI (`pnpm run agent-control-ui:start`) on the host machine.
      </p>
    </div>
  )
}

function RemoteControlReadyState(props: {
  readonly state: AgentControlStatePayload
  readonly controller: AgentControlPanelController
}): JSX.Element {
  return (
    <>
      <div class="grid gap-3 md:grid-cols-2">
        <PolicySummaryCard policy={props.state.policy} />
        <PendingCommandsCard commands={props.state.commands} />
      </div>

      <ReasonInput
        value={props.controller.reasonDraft()}
        onInput={props.controller.setReasonDraft}
      />

      <div class="grid gap-3 md:grid-cols-2">
        <UpdatesActionsCard
          desiredVersion={props.controller.desiredVersionDraft()}
          channel={props.controller.channelDraft()}
          canRunActions={props.controller.canRunActions()}
          onDesiredVersionInput={props.controller.setDesiredVersionDraft}
          onChannelInput={props.controller.setChannelDraft}
          onForceUpdate={props.controller.handleRequestUpdate}
          onClearForcedTarget={props.controller.handleClearDesiredVersion}
        />
        <PolicyActionsCard
          blockedVersions={props.controller.blockedVersionsDraft()}
          canRunActions={props.controller.canRunActions()}
          onBlockedVersionsInput={props.controller.setBlockedVersionsDraft}
          onPauseUpdates={props.controller.handlePauseUpdates}
          onResumeUpdates={props.controller.handleResumeUpdates}
          onApplyChannel={props.controller.handleApplyChannel}
          onSaveBlockedVersions={props.controller.handleSaveBlockedVersions}
        />
      </div>

      <DangerActionsRow
        canRunActions={props.controller.canRunActions()}
        onRequestRestart={props.controller.handleRequestRestart}
        onRequestReset={props.controller.handleRequestReset}
      />

      <Section title="Local-only Capabilities">
        <LocalOnlyCapabilities />
      </Section>
    </>
  )
}

function useAgentControlPanelController(
  props: AgentControlPanelProps,
): AgentControlPanelController {
  const [controlState, { refetch }] = createResource(() => props.agentId, fetchAgentControlState)
  const [busyAction, setBusyAction] = createSignal<string | null>(null)
  const [reasonDraft, setReasonDraft] = createSignal('')
  const [desiredVersionDraft, setDesiredVersionDraft] = createSignal('')
  const [channelDraft, setChannelDraft] = createSignal('')
  const [blockedVersionsDraft, setBlockedVersionsDraft] = createSignal('')

  createEffect(() => {
    props.agentId
    setBusyAction(null)
    setReasonDraft('')
    setDesiredVersionDraft('')
    setChannelDraft('')
    setBlockedVersionsDraft('')
  })

  createEffect(() => {
    const state = controlState()
    if (!state) return
    setBusyAction(null)
    setReasonDraft('')
    setDesiredVersionDraft('')
    setChannelDraft(state.policy.updateChannel ?? '')
    setBlockedVersionsDraft(state.policy.blockedVersions.join('\n'))
  })

  async function refreshSnapshots(): Promise<void> {
    await refetch()
    await Promise.resolve(props.onAfterAction())
  }

  async function executeAction(command: ActionExecutionCommand): Promise<void> {
    const reason = normalizeOptionalText(reasonDraft())
    if (!reason) {
      props.onActionError('Reason is required to execute control actions.')
      return
    }

    if (command.confirmation && !window.confirm(command.confirmation)) {
      return
    }

    setBusyAction(command.label)
    props.onActionError(null)

    try {
      const result = await command.action(reason)
      props.onActionMessage(command.successMessage(result.requestedAt))
      await refreshSnapshots()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      props.onActionError(message)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRequestUpdate(): Promise<void> {
    const desiredVersion = normalizeOptionalText(desiredVersionDraft())
    const updateChannel = normalizeOptionalText(channelDraft())
    if (!desiredVersion) {
      props.onActionError('Desired version is required.')
      return
    }
    if (!updateChannel) {
      props.onActionError('Update channel is required.')
      return
    }

    await executeAction({
      label: 'request-update',
      action: (reason) =>
        requestAgentUpdate({
          agentId: props.agentId,
          desiredVersion,
          updateChannel,
          reason,
        }),
      successMessage: (requestedAt) =>
        `Remote update to ${desiredVersion} requested at ${requestedAt}`,
      confirmation: `Request remote update to version ${desiredVersion}?`,
    })
  }

  async function handleRequestRestart(): Promise<void> {
    await executeAction({
      label: 'request-restart',
      action: (reason) =>
        requestAgentRestart({
          agentId: props.agentId,
          reason,
        }),
      successMessage: (requestedAt) => `Remote restart requested at ${requestedAt}`,
      confirmation: 'Request remote restart now?',
    })
  }

  async function handleRequestReset(): Promise<void> {
    await executeAction({
      label: 'request-reset',
      action: (reason) =>
        requestAgentReset({
          agentId: props.agentId,
          reason,
        }),
      successMessage: (requestedAt) => `Remote reset requested at ${requestedAt}`,
      confirmation: 'Request remote reset? This will clear local overrides on the agent host.',
    })
  }

  async function handleSetPaused(updatesPaused: boolean): Promise<void> {
    await executeAction({
      label: updatesPaused ? 'pause-updates' : 'resume-updates',
      action: (reason) =>
        updateAgentRemotePolicy({
          agentId: props.agentId,
          updatesPaused,
          reason,
        }),
      successMessage: (requestedAt) =>
        `Remote updates ${updatesPaused ? 'paused' : 'resumed'} at ${requestedAt}`,
      ...(updatesPaused ? { confirmation: 'Pause remote updates for this agent?' } : {}),
    })
  }

  async function handleApplyChannel(): Promise<void> {
    const updateChannel = normalizeOptionalText(channelDraft())
    if (!updateChannel) {
      props.onActionError('Channel value is required.')
      return
    }

    await executeAction({
      label: 'change-channel',
      action: (reason) =>
        updateAgentRemotePolicy({
          agentId: props.agentId,
          updateChannel,
          reason,
        }),
      successMessage: (requestedAt) => `Remote channel set to ${updateChannel} at ${requestedAt}`,
    })
  }

  async function handleSaveBlockedVersions(): Promise<void> {
    const blockedVersions = parseBlockedVersionsDraft(blockedVersionsDraft())
    await executeAction({
      label: 'blocked-versions',
      action: (reason) =>
        updateAgentRemotePolicy({
          agentId: props.agentId,
          blockedVersions,
          reason,
        }),
      successMessage: (requestedAt) => `Remote blocked versions updated at ${requestedAt}`,
    })
  }

  async function handleClearDesiredVersion(): Promise<void> {
    await executeAction({
      label: 'clear-desired-version',
      action: (reason) =>
        updateAgentRemotePolicy({
          agentId: props.agentId,
          desiredVersion: null,
          reason,
        }),
      successMessage: (requestedAt) => `Remote desired version cleared at ${requestedAt}`,
      confirmation: 'Clear remote forced target version?',
    })
  }

  return {
    controlState,
    loading: () => controlState.loading,
    hasError: () => Boolean(controlState.error),
    busyAction,
    reasonDraft,
    desiredVersionDraft,
    channelDraft,
    blockedVersionsDraft,
    canRunActions: () => busyAction() === null,
    setReasonDraft,
    setDesiredVersionDraft,
    setChannelDraft,
    setBlockedVersionsDraft,
    handleRequestUpdate,
    handleRequestRestart,
    handleRequestReset,
    handlePauseUpdates: () => handleSetPaused(true),
    handleResumeUpdates: () => handleSetPaused(false),
    handleApplyChannel,
    handleSaveBlockedVersions,
    handleClearDesiredVersion,
  }
}

export function AgentControlPanel(props: AgentControlPanelProps): JSX.Element {
  const controller = useAgentControlPanelController(props)
  const viewState = () =>
    resolveRemoteControlStateView({
      hasError: controller.hasError(),
      controlState: controller.controlState(),
    })

  return (
    <Section title="Remote Control">
      <Show
        when={!controller.loading()}
        fallback={<p class="text-sm-ui text-text-muted">Loading remote control state...</p>}
      >
        <Show
          when={viewState() !== 'error'}
          fallback={
            <p class="text-sm-ui text-tone-danger-fg">Failed to load remote control state.</p>
          }
        >
          <Show
            when={viewState() === 'ready' ? controller.controlState() : null}
            fallback={
              <p class="text-sm-ui text-text-muted">Remote control not available for this agent.</p>
            }
          >
            {(stateAccessor) => (
              <RemoteControlReadyState state={stateAccessor()} controller={controller} />
            )}
          </Show>
        </Show>
      </Show>
    </Section>
  )
}
