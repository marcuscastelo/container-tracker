import type {
  AgentControlBackendState,
  AgentControlCommandResult,
  AgentControlLogChannel,
  AgentControlLogsResponse,
  AgentControlPaths,
  AgentInstalledRelease,
  AgentOperationalSnapshot,
  AgentReleaseInventory,
  ResolvedSource,
} from '@tools/agent/control-core/contracts'
import { AgentControlLogChannelSchema } from '@tools/agent/control-core/contracts'
import type { AgentControlRendererApi } from '@tools/agent-control-ui/ipc'
import { createMemo, createSignal, For, type JSX, onMount, Show } from 'solid-js'

type LoadState = 'loading' | 'ready' | 'error'

type CommandRunner = () => Promise<AgentControlCommandResult>

function logsRequireAction(): boolean {
  return window.agentControlMeta?.logsRequireAction === true
}

function resolvedSourceLabel(source: ResolvedSource): string {
  if (source === 'REMOTE_COMMAND') return 'Remote Command'
  if (source === 'REMOTE_POLICY') return 'Remote Policy'
  if (source === 'LOCAL') return 'Local Override'
  return 'Base'
}

function backendSourceLabel(source: AgentControlBackendState['source']): string {
  if (source === 'RUNTIME_CONFIG') return 'Runtime Config'
  if (source === 'BASE_RUNTIME_CONFIG') return 'Base Runtime Config'
  if (source === 'BOOTSTRAP') return 'Bootstrap'
  if (source === 'CONSUMED_BOOTSTRAP') return 'Consumed Bootstrap'
  return 'Unavailable'
}

function backendStatusLabel(status: AgentControlBackendState['status']): string {
  if (status === 'ENROLLED') return 'Enrolled'
  if (status === 'BOOTSTRAP_ONLY') return 'Bootstrap Only'
  return 'Unconfigured'
}

function snapshotStatusText(
  snapshot: AgentOperationalSnapshot | null,
  backendState: AgentControlBackendState | null,
): string {
  if (snapshot) {
    return `${snapshot.runtime.status} / ${snapshot.runtime.health}`
  }

  if (backendState?.status === 'BOOTSTRAP_ONLY') {
    return 'Waiting for initial enrollment'
  }

  if (backendState?.status === 'UNCONFIGURED') {
    return 'Backend setup required'
  }

  return 'Loading control state...'
}

function parseLogChannel(value: string): AgentControlLogChannel {
  const parsed = AgentControlLogChannelSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

function getAgentControlBridge(): AgentControlRendererApi {
  if (
    typeof window.agentControl?.getBackendState !== 'function' ||
    typeof window.agentControl?.getSnapshot !== 'function' ||
    typeof window.agentControl?.getLogs !== 'function' ||
    typeof window.agentControl?.startAgent !== 'function'
  ) {
    throw new Error(
      'Electron preload bridge is unavailable. Close the window and open the app again with pnpm run agent-control-ui:start.',
    )
  }

  return window.agentControl
}

function SourceBadge(props: { readonly source: ResolvedSource }) {
  return (
    <span class={`source-badge source-${props.source.toLowerCase()}`}>
      {resolvedSourceLabel(props.source)}
    </span>
  )
}

function Section(props: { readonly title: string; readonly children: JSX.Element }) {
  return (
    <section class="panel">
      <div class="panel-header">
        <h2>{props.title}</h2>
      </div>
      <div class="panel-body">{props.children}</div>
    </section>
  )
}

function KeyValue(props: { readonly label: string; readonly value: string }) {
  return (
    <div class="kv-row">
      <span class="kv-label">{props.label}</span>
      <span class="kv-value">{props.value}</span>
    </div>
  )
}

function ResolvedValueRow(props: {
  readonly label: string
  readonly value: string
  readonly source: ResolvedSource
  readonly overridden: readonly { readonly source: ResolvedSource; readonly value: string }[]
}) {
  return (
    <div class="resolved-row">
      <div class="resolved-main">
        <span class="kv-label">{props.label}</span>
        <span class="resolved-value">{props.value}</span>
        <SourceBadge source={props.source} />
      </div>
      <Show when={props.overridden.length > 0}>
        <div class="override-stack">
          <For each={props.overridden}>
            {(entry) => (
              <div class="override-chip">
                <span>{entry.value}</span>
                <SourceBadge source={entry.source} />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function SnapshotUnavailableBody(props: { readonly message: string }) {
  return <div class="empty-state">{props.message}</div>
}

function BackendPanel(props: {
  readonly state: AgentControlBackendState | null
  readonly draft: string
  readonly disabled: boolean
  readonly onDraftChange: (value: string) => void
  readonly onApply: () => Promise<void>
}) {
  return (
    <Section title="Backend">
      <Show
        when={props.state}
        fallback={
          <SnapshotUnavailableBody message="Backend state is not available yet. Try refreshing the UI." />
        }
      >
        {(stateAccessor) => {
          const state = stateAccessor()
          return (
            <>
              <div class="kv-grid">
                <KeyValue label="Status" value={backendStatusLabel(state.status)} />
                <KeyValue label="Source" value={backendSourceLabel(state.source)} />
                <KeyValue
                  label="Current URL"
                  value={state.backendUrl ?? 'not configured'}
                />
                <KeyValue
                  label="Installer token"
                  value={state.installerTokenAvailable ? 'available' : 'missing or redacted'}
                />
              </div>
              <label class="stack-field">
                <span>Backend URL</span>
                <input
                  type="url"
                  value={props.draft}
                  onInput={(event) => props.onDraftChange(event.currentTarget.value)}
                  placeholder="https://backend.example.com"
                />
              </label>
              <div class="toolbar-row">
                <button
                  type="button"
                  class="action-button"
                  disabled={props.disabled || props.draft.trim().length === 0}
                  onClick={() => void props.onApply()}
                >
                  Apply backend and restart
                </button>
              </div>
              <Show when={state.warnings.length > 0}>
                <div class="list-block">
                  <For each={state.warnings}>
                    {(warning) => <div class="banner banner-warning">{warning}</div>}
                  </For>
                </div>
              </Show>
            </>
          )
        }}
      </Show>
    </Section>
  )
}

function ReleasesTable(props: {
  readonly releases: readonly AgentInstalledRelease[]
  readonly onActivate: (version: string) => Promise<void>
}) {
  return (
    <div class="release-list">
      <For each={props.releases}>
        {(release) => (
          <div class="release-row">
            <div>
              <div class="release-version">{release.version}</div>
              <div class="release-meta">
                <Show when={release.isCurrent}>
                  <span class="pill pill-current">current</span>
                </Show>
                <Show when={release.isPrevious}>
                  <span class="pill pill-previous">previous</span>
                </Show>
                <Show when={release.isTarget}>
                  <span class="pill pill-target">target</span>
                </Show>
                <Show when={!release.entrypointPath}>
                  <span class="pill pill-missing">missing entrypoint</span>
                </Show>
              </div>
            </div>
            <button
              type="button"
              class="action-button"
              disabled={!release.entrypointPath}
              onClick={() => void props.onActivate(release.version)}
            >
              Activate
            </button>
          </div>
        )}
      </For>
    </div>
  )
}

function LogsPanel(props: {
  readonly lines: readonly AgentControlLogsResponse['lines'][number][]
  readonly selectedChannel: AgentControlLogChannel
  readonly tail: string
  readonly logsRequireAction: boolean
  readonly onChannelChange: (value: AgentControlLogChannel) => void
  readonly onTailChange: (value: string) => void
  readonly onRefresh: () => Promise<void>
}) {
  return (
    <Section title="Logs">
      <div class="toolbar-row">
        <label class="inline-field">
          <span>Channel</span>
          <select
            value={props.selectedChannel}
            onInput={(event) => props.onChannelChange(parseLogChannel(event.currentTarget.value))}
          >
            <option value="all">All</option>
            <option value="stdout">stdout</option>
            <option value="stderr">stderr</option>
            <option value="supervisor">supervisor</option>
            <option value="updater">updater</option>
          </select>
        </label>
        <label class="inline-field">
          <span>Tail</span>
          <input
            type="number"
            min="1"
            max="2000"
            value={props.tail}
            onInput={(event) => props.onTailChange(event.currentTarget.value)}
          />
        </label>
        <button type="button" class="action-button" onClick={() => void props.onRefresh()}>
          Refresh logs
        </button>
      </div>
      <Show when={props.logsRequireAction && props.lines.length === 0}>
        <div class="banner banner-neutral">
          Logs ficam sob demanda nesta instalacao Linux e podem pedir autenticacao local quando
          voce clicar em refresh.
        </div>
      </Show>
      <pre class="logs-surface">
        <For each={props.lines}>
          {(line) => (
            <div>
              [{line.channel}] {line.message}
            </div>
          )}
        </For>
      </pre>
    </Section>
  )
}

export function AgentControlApp() {
  const [loadState, setLoadState] = createSignal<LoadState>('loading')
  const [backendState, setBackendState] = createSignal<AgentControlBackendState | null>(null)
  const [snapshot, setSnapshot] = createSignal<AgentOperationalSnapshot | null>(null)
  const [releases, setReleases] = createSignal<AgentReleaseInventory['releases']>([])
  const [paths, setPaths] = createSignal<AgentControlPaths | null>(null)
  const [logLines, setLogLines] = createSignal<AgentControlLogsResponse['lines']>([])
  const [message, setMessage] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [snapshotIssue, setSnapshotIssue] = createSignal<string | null>(null)
  const [busyAction, setBusyAction] = createSignal<string | null>(null)
  const [backendDraft, setBackendDraft] = createSignal('')
  const [channelDraft, setChannelDraft] = createSignal('')
  const [blockedDraft, setBlockedDraft] = createSignal('')
  const [configDraft, setConfigDraft] = createSignal<Record<string, string>>({})
  const [selectedLogChannel, setSelectedLogChannel] = createSignal<AgentControlLogChannel>('all')
  const [tail, setTail] = createSignal('200')

  const runtimeConfigAvailable = createMemo(
    () => backendState()?.runtimeConfigAvailable === true,
  )
  const runtimeOperationsAvailable = createMemo(() => backendState()?.status === 'ENROLLED')

  function toErrorMessage(value: unknown): string {
    if (value instanceof Error) return value.message
    return String(value)
  }

  function syncSnapshotDrafts(nextSnapshot: AgentOperationalSnapshot): void {
    setChannelDraft(
      nextSnapshot.updates.channel.source === 'BASE' ? '' : nextSnapshot.updates.channel.value,
    )
    setBlockedDraft(nextSnapshot.updates.blockedVersions.local.join('\n'))
    setConfigDraft(nextSnapshot.config.editable)
  }

  function syncBackendDraft(nextBackendState: AgentControlBackendState): void {
    setBackendDraft(nextBackendState.backendUrl ?? '')
  }

  async function refreshLogs(): Promise<void> {
    try {
      const logs = await getAgentControlBridge().getLogs({
        channel: selectedLogChannel(),
        tail: Number.parseInt(tail(), 10) || 200,
        interactive: true,
      })
      setLogLines(logs.lines)
    } catch (refreshError) {
      setError(toErrorMessage(refreshError))
    }
  }

  async function refresh(): Promise<void> {
    setLoadState('loading')
    setError(null)
    setSnapshotIssue(null)

    try {
      const agentControl = getAgentControlBridge()
      const [backendResult, snapshotResult, releaseResult, pathsResult] = await Promise.allSettled(
        [
          agentControl.getBackendState(),
          agentControl.getSnapshot(),
          agentControl.getReleaseInventory(),
          agentControl.getPaths(),
        ],
      )

      let loadedAny = false

      if (backendResult.status === 'fulfilled') {
        setBackendState(backendResult.value)
        syncBackendDraft(backendResult.value)
        loadedAny = true
      } else {
        setBackendState(null)
      }

      if (snapshotResult.status === 'fulfilled') {
        setSnapshot(snapshotResult.value)
        syncSnapshotDrafts(snapshotResult.value)
        loadedAny = true
      } else {
        setSnapshot(null)
        setSnapshotIssue(toErrorMessage(snapshotResult.reason))
      }

      if (releaseResult.status === 'fulfilled') {
        setReleases(releaseResult.value.releases)
        loadedAny = true
      } else {
        setReleases([])
      }

      if (pathsResult.status === 'fulfilled') {
        setPaths(pathsResult.value)
        loadedAny = true
      } else {
        setPaths(null)
      }

      if (snapshotResult.status === 'fulfilled' && !logsRequireAction()) {
        try {
          const logs = await agentControl.getLogs({
            channel: selectedLogChannel(),
            tail: Number.parseInt(tail(), 10) || 200,
            interactive: false,
          })
          setLogLines(logs.lines)
        } catch {
          setLogLines([])
        }
      } else {
        setLogLines([])
      }

      if (!loadedAny) {
        throw new Error('The control service did not return any readable state.')
      }

      setLoadState('ready')
    } catch (refreshError) {
      setError(toErrorMessage(refreshError))
      setLoadState('error')
    }
  }

  async function runAction(
    label: string,
    command: CommandRunner,
    confirmationMessage?: string,
  ): Promise<void> {
    if (confirmationMessage && !window.confirm(confirmationMessage)) {
      return
    }

    setBusyAction(label)
    setError(null)
    try {
      const result = await command()
      setMessage(result.message)
      await refresh()
    } catch (commandError) {
      setError(toErrorMessage(commandError))
    } finally {
      setBusyAction(null)
    }
  }

  async function applyBackendDraft(): Promise<void> {
    if (
      !window.confirm(
        'Update BACKEND_URL and restart the installed agent service? The runtime will reconnect using this backend on the next boot cycle.',
      )
    ) {
      return
    }

    setBusyAction('set-backend-url')
    setError(null)
    try {
      const result = await getAgentControlBridge().setBackendUrl({
        backendUrl: backendDraft().trim(),
      })
      setMessage(result.message)
      setBackendState(result.state)
      syncBackendDraft(result.state)
      await refresh()
    } catch (commandError) {
      setError(toErrorMessage(commandError))
    } finally {
      setBusyAction(null)
    }
  }

  async function activateRelease(version: string): Promise<void> {
    await runAction(
      `activate-${version}`,
      () => getAgentControlBridge().activateRelease({ version }),
      `Activate release ${version}? The runtime will be drained and restarted.`,
    )
  }

  function updateDraftValue(key: string, value: string): void {
    setConfigDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function applyChannelDraft(): void {
    const normalized = channelDraft().trim()
    const channel = normalized.length > 0 ? normalized : null
    void runAction('change-channel', () => getAgentControlBridge().changeChannel({ channel }))
  }

  function saveBlockedVersionsDraft(): void {
    const versions = blockedDraft()
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    void runAction('blocked-versions', () =>
      getAgentControlBridge().setBlockedVersions({ versions }),
    )
  }

  function saveConfigDraft(): void {
    const patch = configDraft()
    void runAction('update-config', () => getAgentControlBridge().updateConfig({ patch }))
  }

  onMount(() => {
    void refresh()
  })

  return (
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Container Tracker Agent</p>
          <h1>Agent Control UI</h1>
          <p class="subtle">{snapshotStatusText(snapshot(), backendState())}</p>
        </div>
        <div class="hero-actions">
          <button type="button" class="action-button" onClick={() => void refresh()}>
            Refresh
          </button>
          <button
            type="button"
            class="action-button"
            disabled={busyAction() !== null || !runtimeOperationsAvailable()}
            onClick={() => void runAction('start', () => getAgentControlBridge().startAgent())}
          >
            Start
          </button>
          <button
            type="button"
            class="action-button"
            disabled={busyAction() !== null || !runtimeOperationsAvailable()}
            onClick={() =>
              void runAction(
                'stop',
                () => getAgentControlBridge().stopAgent(),
                'Stop the agent runtime now?',
              )
            }
          >
            Stop
          </button>
          <button
            type="button"
            class="action-button"
            disabled={busyAction() !== null || !runtimeOperationsAvailable()}
            onClick={() =>
              void runAction(
                'restart',
                () => getAgentControlBridge().restartAgent(),
                'Restart the agent runtime now?',
              )
            }
          >
            Restart
          </button>
          <button
            type="button"
            class="danger-button"
            disabled={busyAction() !== null || !runtimeConfigAvailable()}
            onClick={() =>
              void runAction(
                'local-reset',
                () => getAgentControlBridge().executeLocalReset(),
                'Run a local reset? Local overrides will be cleared and the runtime will restart.',
              )
            }
          >
            Local Reset
          </button>
        </div>
      </header>

      <Show when={message()}>
        {(currentMessage) => <div class="banner banner-success">{currentMessage()}</div>}
      </Show>
      <Show when={error()}>
        {(currentError) => <div class="banner banner-danger">{currentError()}</div>}
      </Show>
      <Show when={snapshotIssue()}>
        {(currentIssue) => <div class="banner banner-warning">{currentIssue()}</div>}
      </Show>
      <Show when={backendState()?.status !== 'ENROLLED'}>
        <div class="banner banner-neutral">
          Runtime controls that depend on `config.env` stay locked until the agent completes
          enrollment. Backend selection remains available in bootstrap mode.
        </div>
      </Show>
      <Show when={snapshot()?.infra.source === 'FALLBACK'}>
        <div class="banner banner-warning">
          Infra config is using local fallback cache. Remote fetch is currently degraded.
        </div>
      </Show>
      <Show when={loadState() === 'loading'}>
        <div class="banner banner-neutral">Loading control state...</div>
      </Show>

      <div class="dashboard-grid">
        <BackendPanel
          state={backendState()}
          draft={backendDraft()}
          disabled={busyAction() !== null}
          onDraftChange={setBackendDraft}
          onApply={applyBackendDraft}
        />

        <Section title="Status">
          <Show
            when={snapshot()}
            fallback={
              <SnapshotUnavailableBody message="Operational snapshot is unavailable until the runtime publishes control state." />
            }
          >
            {(currentSnapshot) => (
              <div class="kv-grid">
                <KeyValue label="Runtime" value={currentSnapshot().runtime.status} />
                <KeyValue label="Health" value={currentSnapshot().runtime.health} />
                <KeyValue
                  label="Heartbeat"
                  value={currentSnapshot().runtime.lastHeartbeatAt ?? 'not available'}
                />
                <KeyValue
                  label="Active jobs"
                  value={String(currentSnapshot().runtime.activeJobs)}
                />
              </div>
            )}
          </Show>
        </Section>

        <Section title="Updates">
          <Show
            when={snapshot()}
            fallback={
              <SnapshotUnavailableBody message="Update policy appears here after enrollment completes and the runtime publishes a snapshot." />
            }
          >
            {(currentSnapshot) => (
              <>
                <ResolvedValueRow
                  label="Updates paused"
                  value={currentSnapshot().updates.paused.value ? 'true' : 'false'}
                  source={currentSnapshot().updates.paused.source}
                  overridden={currentSnapshot().updates.paused.overridden.map((entry) => ({
                    source: entry.source,
                    value: entry.value ? 'true' : 'false',
                  }))}
                />
                <ResolvedValueRow
                  label="Channel"
                  value={currentSnapshot().updates.channel.value}
                  source={currentSnapshot().updates.channel.source}
                  overridden={currentSnapshot().updates.channel.overridden}
                />
                <div class="toolbar-row">
                  <button
                    type="button"
                    class="action-button"
                    disabled={busyAction() !== null}
                    onClick={() =>
                      void runAction('pause-updates', () => getAgentControlBridge().pauseUpdates())
                    }
                  >
                    Pause locally
                  </button>
                  <button
                    type="button"
                    class="action-button"
                    disabled={busyAction() !== null}
                    onClick={() =>
                      void runAction('resume-updates', () =>
                        getAgentControlBridge().resumeUpdates(),
                      )
                    }
                  >
                    Resume locally
                  </button>
                </div>
                <label class="stack-field">
                  <span>Local channel override</span>
                  <input
                    type="text"
                    value={channelDraft()}
                    onInput={(event) => setChannelDraft(event.currentTarget.value)}
                    placeholder="Leave empty to fall back to base"
                  />
                </label>
                <div class="toolbar-row">
                  <button type="button" class="action-button" onClick={() => applyChannelDraft()}>
                    Apply channel
                  </button>
                </div>
                <label class="stack-field">
                  <span>Local blocked versions</span>
                  <textarea
                    rows="5"
                    value={blockedDraft()}
                    onInput={(event) => setBlockedDraft(event.currentTarget.value)}
                    placeholder="One version per line"
                  />
                </label>
                <button
                  type="button"
                  class="action-button"
                  onClick={() => saveBlockedVersionsDraft()}
                >
                  Save blocked versions
                </button>
                <div class="list-block">
                  <KeyValue
                    label="Remote blocked"
                    value={currentSnapshot().updates.blockedVersions.remote.join(', ') || 'none'}
                  />
                  <KeyValue
                    label="Effective blocked"
                    value={
                      currentSnapshot().updates.blockedVersions.effective.join(', ') || 'none'
                    }
                  />
                  <KeyValue
                    label="Forced target"
                    value={currentSnapshot().updates.forceTargetVersion ?? 'none'}
                  />
                </div>
              </>
            )}
          </Show>
        </Section>

        <Section title="Releases">
          <Show
            when={releases().length > 0}
            fallback={<div class="empty-state">No releases found.</div>}
          >
            <ReleasesTable releases={releases()} onActivate={activateRelease} />
          </Show>
          <button
            type="button"
            class="danger-button"
            disabled={busyAction() !== null || releases().length === 0}
            onClick={() =>
              void runAction(
                'rollback',
                () => getAgentControlBridge().rollbackRelease(),
                'Execute rollback to the previous release?',
              )
            }
          >
            Rollback
          </button>
        </Section>

        <Section title="Config">
          <Show
            when={snapshot()}
            fallback={
              <SnapshotUnavailableBody message="Editable runtime config unlocks after enrollment creates config.env." />
            }
          >
            {(currentSnapshot) => (
              <>
                <div class="config-grid">
                  <For each={Object.entries(configDraft())}>
                    {([key, value]) => (
                      <label class="stack-field">
                        <span>{key}</span>
                        <input
                          type="text"
                          value={value}
                          onInput={(event) => updateDraftValue(key, event.currentTarget.value)}
                        />
                      </label>
                    )}
                  </For>
                </div>
                <button type="button" class="action-button" onClick={() => saveConfigDraft()}>
                  Save local config
                </button>
                <KeyValue
                  label="Restart required keys"
                  value={currentSnapshot().config.requiresRestart.join(', ') || 'none'}
                />
              </>
            )}
          </Show>
        </Section>
      </div>

      <LogsPanel
        lines={logLines()}
        selectedChannel={selectedLogChannel()}
        tail={tail()}
        logsRequireAction={logsRequireAction()}
        onChannelChange={setSelectedLogChannel}
        onTailChange={setTail}
        onRefresh={refreshLogs}
      />

      <Section title="Advanced">
        <div class="advanced-grid">
          <div>
            <h3>Snapshot</h3>
            <pre class="json-surface">{JSON.stringify(snapshot(), null, 2)}</pre>
          </div>
          <div>
            <h3>Paths</h3>
            <pre class="json-surface">{JSON.stringify(paths(), null, 2)}</pre>
          </div>
        </div>
      </Section>
    </main>
  )
}
