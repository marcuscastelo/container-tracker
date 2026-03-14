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

function JsonBlock(props: { readonly title: string; readonly value: unknown }): JSX.Element {
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

function ReplayComparisonSummary(props: { readonly replay: TrackingReplayResponse }): JSX.Element {
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

function ComparisonChip(props: { readonly label: string; readonly matches: boolean }): JSX.Element {
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

function ReplayActions(props: {
  readonly replay: TrackingReplayResponse | undefined
  readonly loading: boolean
  readonly containerNumber: string
  readonly selectedStepIndex: number
  readonly onRunReplay: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onDownload: (replay: TrackingReplayResponse) => void
}): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground"
        onClick={() => props.onRunReplay()}
      >
        {props.loading ? 'Replaying…' : 'Run replay'}
      </button>
      <Show when={props.replay}>
        {(result) => (
          <ReplayNavigationActions
            replay={result()}
            containerNumber={props.containerNumber}
            selectedStepIndex={props.selectedStepIndex}
            onPrevious={props.onPrevious}
            onNext={props.onNext}
            onDownload={props.onDownload}
          />
        )}
      </Show>
    </div>
  )
}

function ReplayNavigationActions(props: {
  readonly replay: TrackingReplayResponse
  readonly containerNumber: string
  readonly selectedStepIndex: number
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onDownload: (replay: TrackingReplayResponse) => void
}): JSX.Element {
  return (
    <>
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
        disabled={props.selectedStepIndex <= 0}
        onClick={() => props.onPrevious()}
      >
        Previous
      </button>
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
        disabled={props.selectedStepIndex >= props.replay.steps.length - 1}
        onClick={() => props.onNext()}
      >
        Next
      </button>
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground"
        onClick={() => props.onDownload(props.replay)}
      >
        Export JSON
      </button>
    </>
  )
}

function ReplayStepInspector(props: {
  readonly containerNumber: string
  readonly maxStep: number
  readonly selectedStepIndex: number
  readonly step: TrackingReplayResponse['steps'][number] | null
  readonly onSelectStep: (index: number) => void
}): JSX.Element {
  return (
    <Show when={props.maxStep > 0}>
      <div class="space-y-2 rounded-md border border-border/70 bg-surface p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs-ui font-medium text-foreground">
            Step {props.selectedStepIndex + 1} / {props.maxStep}
          </div>
          <div class="text-xs-ui text-text-muted">Stage: {props.step?.stage ?? 'N/A'}</div>
        </div>
        <input
          type="range"
          min="1"
          max={String(props.maxStep)}
          value={String(props.selectedStepIndex + 1)}
          class="w-full"
          aria-label={`Tracking replay step for ${props.containerNumber}`}
          aria-valuemin={1}
          aria-valuemax={props.maxStep}
          aria-valuenow={props.selectedStepIndex + 1}
          aria-valuetext={`Step ${props.selectedStepIndex + 1} of ${props.maxStep}`}
          onInput={(event) =>
            props.onSelectStep(Math.max(0, Number(event.currentTarget.value) - 1))
          }
        />
        <Show when={props.step}>
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
  )
}

function ReplayResultDetails(props: {
  readonly containerNumber: string
  readonly replay: TrackingReplayResponse
  readonly selectedStepIndex: number
  readonly step: TrackingReplayResponse['steps'][number] | null
  readonly onSelectStep: (index: number) => void
}): JSX.Element {
  return (
    <div class="space-y-3">
      <div class="grid gap-2 sm:grid-cols-4">
        <MetricCard label="Snapshots" value={String(props.replay.total_snapshots)} />
        <MetricCard label="Observations" value={String(props.replay.total_observations)} />
        <MetricCard label="Steps" value={String(props.replay.total_steps)} />
        <MetricCard label="Final status" value={props.replay.final_status} />
      </div>

      <ReplayComparisonSummary replay={props.replay} />

      <ReplayStepInspector
        containerNumber={props.containerNumber}
        maxStep={props.replay.steps.length}
        selectedStepIndex={props.selectedStepIndex}
        step={props.step}
        onSelectStep={props.onSelectStep}
      />
    </div>
  )
}

export function TrackingReplayDebugPanel(props: TrackingReplayDebugPanelProps): JSX.Element {
  const [requestNonce, setRequestNonce] = createSignal(0)
  const [selectedStepIndex, setSelectedStepIndex] = createSignal(0)
  const [downloadAnnouncement, setDownloadAnnouncement] = createSignal('')
  const [replay] = createResource(
    () => {
      const nonce = requestNonce()
      return nonce > 0 ? { containerId: props.containerId, nonce } : null
    },
    async (request) => fetchTrackingReplay(request.containerId),
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
      <div class="sr-only" aria-live="polite">
        {downloadAnnouncement()}
      </div>
      <ReplayActions
        replay={replay()}
        loading={replay.loading}
        containerNumber={props.containerNumber}
        selectedStepIndex={selectedStepIndex()}
        onRunReplay={() => setRequestNonce((current) => current + 1)}
        onPrevious={() => setSelectedStepIndex((current) => Math.max(0, current - 1))}
        onNext={() => setSelectedStepIndex((current) => Math.min(maxStep() - 1, current + 1))}
        onDownload={(result) => {
          downloadReplay(props.containerNumber, result)
          setDownloadAnnouncement(`Replay download started for ${props.containerNumber}`)
        }}
      />

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
            Run the replay to inspect snapshots, normalized observations, derived series, timeline,
            status, and alerts for {props.containerNumber}.
          </p>
        }
      >
        {(result) => (
          <ReplayResultDetails
            containerNumber={props.containerNumber}
            replay={result()}
            selectedStepIndex={selectedStepIndex()}
            step={currentStep()}
            onSelectStep={setSelectedStepIndex}
          />
        )}
      </Show>
    </Panel>
  )
}

function MetricCard(props: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div class="rounded-md border border-border/70 bg-surface px-3 py-2">
      <div class="text-micro uppercase tracking-wider text-text-muted">{props.label}</div>
      <div class="text-sm-ui font-semibold text-foreground">{props.value}</div>
    </div>
  )
}
