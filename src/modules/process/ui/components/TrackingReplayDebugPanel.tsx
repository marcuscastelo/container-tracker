import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, Show } from 'solid-js'

import {
  fetchTrackingReplay,
  type TrackingReplayResponse,
} from '~/modules/process/ui/api/trackingReplay.api'
import { Panel } from '~/shared/ui/layout/Panel'

type TrackingReplayDebugPanelProps = {
  readonly containerId: string
  readonly containerNumber: string
}

function JsonBlock(props: {
  readonly title: string
  readonly value: unknown
}): JSX.Element {
  return (
    <section class="space-y-1">
      <h4 class="text-micro font-semibold uppercase tracking-wider text-text-muted">
        {props.title}
      </h4>
      <pre class="max-h-56 overflow-auto rounded-md border border-border/70 bg-surface p-2 text-[11px] text-foreground">
        {JSON.stringify(props.value, null, 2)}
      </pre>
    </section>
  )
}

function ReplayComparisonSummary(props: {
  readonly replay: TrackingReplayResponse
}): JSX.Element {
  return (
    <div class="grid gap-2 sm:grid-cols-3">
      <ComparisonChip
        label="Timeline"
        matches={props.replay.production_comparison.timeline_matches}
      />
      <ComparisonChip label="Status" matches={props.replay.production_comparison.status_matches} />
      <ComparisonChip label="Alerts" matches={props.replay.production_comparison.alerts_match} />
    </div>
  )
}

function ComparisonChip(props: {
  readonly label: string
  readonly matches: boolean
}): JSX.Element {
  return (
    <div
      class={`rounded-md border px-2 py-2 text-xs-ui ${
        props.matches
          ? 'border-tone-positive-border bg-tone-positive-bg text-tone-positive-fg'
          : 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
      }`}
    >
      <div class="font-semibold">{props.label}</div>
      <div>{props.matches ? 'Matches production state' : 'Mismatch detected'}</div>
    </div>
  )
}

function downloadReplay(containerNumber: string, replay: TrackingReplayResponse): void {
  const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${containerNumber}-tracking-replay.json`
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export function TrackingReplayDebugPanel(props: TrackingReplayDebugPanelProps): JSX.Element {
  const [requestNonce, setRequestNonce] = createSignal(0)
  const [selectedStepIndex, setSelectedStepIndex] = createSignal(0)
  const [replay] = createResource(
    () => {
      const nonce = requestNonce()
      return nonce > 0 ? `${props.containerId}:${nonce}` : null
    },
    async () => fetchTrackingReplay(props.containerId),
  )

  createEffect(() => {
    if (replay.state !== 'ready') return
    if (replay()?.steps.length === 0) return
    setSelectedStepIndex(0)
  })

  const currentStep = createMemo(() => {
    const data = replay()
    if (!data) return null
    return data.steps[selectedStepIndex()] ?? null
  })

  const maxStep = createMemo(() => replay()?.steps.length ?? 0)

  return (
    <Panel
      title="Tracking Replay Debug"
      class="rounded-xl border-dashed"
      bodyClass="space-y-3 px-3 py-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground"
          onClick={() => setRequestNonce((current) => current + 1)}
        >
          {replay.loading ? 'Replaying…' : 'Run replay'}
        </button>
        <Show when={replay()}>
          {(result) => (
            <>
              <button
                type="button"
                class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
                disabled={selectedStepIndex() <= 0}
                onClick={() => setSelectedStepIndex((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
                disabled={selectedStepIndex() >= result().steps.length - 1}
                onClick={() =>
                  setSelectedStepIndex((current) =>
                    Math.min(result().steps.length - 1, current + 1),
                  )
                }
              >
                Next
              </button>
              <button
                type="button"
                class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground"
                onClick={() => downloadReplay(props.containerNumber, result())}
              >
                Export JSON
              </button>
            </>
          )}
        </Show>
      </div>

      <Show when={replay.error}>
        {(error) => (
          <div class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-xs-ui text-tone-danger-fg">
            Replay failed: {String(error())}
          </div>
        )}
      </Show>

      <Show
        when={replay()}
        fallback={
          <p class="text-xs-ui text-text-muted">
            Run the replay to inspect snapshots, normalized observations, derived series,
            timeline, status, and alerts for {props.containerNumber}.
          </p>
        }
      >
        {(result) => (
          <div class="space-y-3">
            <div class="grid gap-2 sm:grid-cols-4">
              <MetricCard label="Snapshots" value={String(result().total_snapshots)} />
              <MetricCard label="Observations" value={String(result().total_observations)} />
              <MetricCard label="Steps" value={String(result().total_steps)} />
              <MetricCard label="Final status" value={result().final_status} />
            </div>

            <ReplayComparisonSummary replay={result()} />

            <Show when={maxStep() > 0}>
              <div class="space-y-2 rounded-md border border-border/70 bg-surface p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-xs-ui font-medium text-foreground">
                    Step {selectedStepIndex() + 1} / {maxStep()}
                  </div>
                  <div class="text-xs-ui text-text-muted">
                    Stage: {currentStep()?.stage ?? 'N/A'}
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max={String(maxStep())}
                  value={String(selectedStepIndex() + 1)}
                  class="w-full"
                  onInput={(event) =>
                    setSelectedStepIndex(Math.max(0, Number(event.currentTarget.value) - 1))
                  }
                />
                <Show when={currentStep()}>
                  {(step) => (
                    <div class="grid gap-3 xl:grid-cols-2">
                      <JsonBlock title="Input" value={step().input} />
                      <JsonBlock title="Output" value={step().output} />
                      <JsonBlock title="Derived timeline" value={step().state.timeline} />
                      <JsonBlock
                        title="Derived state"
                        value={{
                          status: step().state.status,
                          alerts: step().state.alerts,
                          observations: step().state.observations.length,
                          series: step().state.series.length,
                        }}
                      />
                    </div>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </Panel>
  )
}

function MetricCard(props: {
  readonly label: string
  readonly value: string
}): JSX.Element {
  return (
    <div class="rounded-md border border-border/70 bg-surface px-3 py-2">
      <div class="text-micro uppercase tracking-wider text-text-muted">{props.label}</div>
      <div class="text-sm-ui font-semibold text-foreground">{props.value}</div>
    </div>
  )
}
