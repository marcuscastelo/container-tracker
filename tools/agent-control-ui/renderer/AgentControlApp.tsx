import type {
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
import { createMemo, createSignal, For, type JSX, onMount, Show } from 'solid-js'

type LoadState = 'loading' | 'ready' | 'error'

type CommandRunner = () => Promise<AgentControlCommandResult>

function SourceBadge(props: { readonly source: ResolvedSource }) {
  const label = createMemo(() => {
    if (props.source === 'REMOTE_COMMAND') return 'Remote Command'
    if (props.source === 'REMOTE_POLICY') return 'Remote Policy'
    if (props.source === 'LOCAL') return 'Local Override'
    return 'Base'
  })

  return <span class={`source-badge source-${props.source.toLowerCase()}`}>{label()}</span>
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

function snapshotStatusText(snapshot: AgentOperationalSnapshot | null): string {
  if (!snapshot) return 'Loading snapshot...'
  return `${snapshot.runtime.status} / ${snapshot.runtime.health}`
}

function parseLogChannel(value: string): AgentControlLogChannel {
  const parsed = AgentControlLogChannelSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

export function AgentControlApp() {
  const [loadState, setLoadState] = createSignal<LoadState>('loading')
  const [snapshot, setSnapshot] = createSignal<AgentOperationalSnapshot | null>(null)
  const [releases, setReleases] = createSignal<AgentReleaseInventory['releases']>([])
  const [paths, setPaths] = createSignal<AgentControlPaths | null>(null)
  const [logLines, setLogLines] = createSignal<AgentControlLogsResponse['lines']>([])
  const [message, setMessage] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busyAction, setBusyAction] = createSignal<string | null>(null)
  const [channelDraft, setChannelDraft] = createSignal('')
  const [blockedDraft, setBlockedDraft] = createSignal('')
  const [configDraft, setConfigDraft] = createSignal<Record<string, string>>({})
  const [selectedLogChannel, setSelectedLogChannel] = createSignal<AgentControlLogChannel>('all')
  const [tail, setTail] = createSignal('200')

  function toErrorMessage(value: unknown): string {
    if (value instanceof Error) return value.message
    return String(value)
  }

  function syncDrafts(nextSnapshot: AgentOperationalSnapshot): void {
    setChannelDraft(
      nextSnapshot.updates.channel.source === 'BASE' ? '' : nextSnapshot.updates.channel.value,
    )
    setBlockedDraft(nextSnapshot.updates.blockedVersions.local.join('\n'))
    setConfigDraft(nextSnapshot.config.editable)
  }

  async function refreshLogs(): Promise<void> {
    try {
      const logs = await window.agentControl.getLogs({
        channel: selectedLogChannel(),
        tail: Number.parseInt(tail(), 10) || 200,
      })
      setLogLines(logs.lines)
    } catch (refreshError) {
      setError(toErrorMessage(refreshError))
    }
  }

  async function refresh(): Promise<void> {
    setLoadState('loading')
    setError(null)
    try {
      const [nextSnapshot, nextReleases, nextPaths] = await Promise.all([
        window.agentControl.getSnapshot(),
        window.agentControl.getReleaseInventory(),
        window.agentControl.getPaths(),
      ])
      setSnapshot(nextSnapshot)
      setReleases(nextReleases.releases)
      setPaths(nextPaths)
      syncDrafts(nextSnapshot)
      await refreshLogs()
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
      setSnapshot(result.snapshot)
      syncDrafts(result.snapshot)
      setReleases((await window.agentControl.getReleaseInventory()).releases)
      await refreshLogs()
    } catch (commandError) {
      setError(toErrorMessage(commandError))
    } finally {
      setBusyAction(null)
    }
  }

  async function activateRelease(version: string): Promise<void> {
    await runAction(
      `activate-${version}`,
      () => window.agentControl.activateRelease({ version }),
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
    void runAction('change-channel', () => window.agentControl.changeChannel({ channel }))
  }

  function saveBlockedVersionsDraft(): void {
    const versions = blockedDraft()
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    void runAction('blocked-versions', () => window.agentControl.setBlockedVersions({ versions }))
  }

  function saveConfigDraft(): void {
    const patch = configDraft()
    void runAction('update-config', () => window.agentControl.updateConfig({ patch }))
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
          <p class="subtle">{snapshotStatusText(snapshot())}</p>
        </div>
        <div class="hero-actions">
          <button type="button" class="action-button" onClick={() => void refresh()}>
            Refresh
          </button>
          <button
            type="button"
            class="action-button"
            disabled={busyAction() !== null}
            onClick={() => void runAction('start', () => window.agentControl.startAgent())}
          >
            Start
          </button>
          <button
            type="button"
            class="action-button"
            disabled={busyAction() !== null}
            onClick={() =>
              void runAction(
                'stop',
                () => window.agentControl.stopAgent(),
                'Stop the agent runtime now?',
              )
            }
          >
            Stop
          </button>
          <button
            type="button"
            class="action-button"
            disabled={busyAction() !== null}
            onClick={() =>
              void runAction(
                'restart',
                () => window.agentControl.restartAgent(),
                'Restart the agent runtime now?',
              )
            }
          >
            Restart
          </button>
          <button
            type="button"
            class="danger-button"
            disabled={busyAction() !== null}
            onClick={() =>
              void runAction(
                'local-reset',
                () => window.agentControl.executeLocalReset(),
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
      <Show when={snapshot()?.infra.source === 'FALLBACK'}>
        <div class="banner banner-warning">
          Infra config is using local fallback cache. Remote fetch is currently degraded.
        </div>
      </Show>

      <Show when={loadState() === 'loading'}>
        <div class="banner banner-neutral">Loading operational snapshot...</div>
      </Show>

      <div class="dashboard-grid">
        <Section title="Status">
          <Show when={snapshot()}>
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
          <Show when={snapshot()}>
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
                      void runAction('pause-updates', () => window.agentControl.pauseUpdates())
                    }
                  >
                    Pause locally
                  </button>
                  <button
                    type="button"
                    class="action-button"
                    disabled={busyAction() !== null}
                    onClick={() =>
                      void runAction('resume-updates', () => window.agentControl.resumeUpdates())
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
                    value={currentSnapshot().updates.blockedVersions.effective.join(', ') || 'none'}
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
            onClick={() =>
              void runAction(
                'rollback',
                () => window.agentControl.rollbackRelease(),
                'Execute rollback to the previous release?',
              )
            }
          >
            Rollback
          </button>
        </Section>

        <Section title="Config">
          <Show when={snapshot()}>
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
