import { For, type JSX, Show } from 'solid-js'
import type { TrackingReplayDiffVM } from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.vm'

type ReplayDiffSummaryViewProps = {
  readonly diff: TrackingReplayDiffVM
}

function CountCard(props: { readonly label: string; readonly value: number }): JSX.Element {
  return (
    <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div class="text-micro uppercase tracking-wide text-slate-500">{props.label}</div>
      <div class="mt-1 text-xs-ui font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function FingerprintList(props: {
  readonly title: string
  readonly values: readonly string[]
}): JSX.Element {
  return (
    <section class="rounded-md border border-slate-200 bg-white p-3">
      <h3 class="text-xs-ui font-semibold text-slate-900">{props.title}</h3>
      <Show
        when={props.values.length > 0}
        fallback={<p class="mt-2 text-xs-ui text-slate-500">None</p>}
      >
        <ul class="mt-2 space-y-1 text-micro text-slate-700">
          <For each={props.values.slice(0, 10)}>
            {(value) => <li class="break-all">{value}</li>}
          </For>
        </ul>
      </Show>
    </section>
  )
}

export function ReplayDiffSummaryView(props: ReplayDiffSummaryViewProps): JSX.Element {
  return (
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Diff Summary</h2>

      <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <CountCard label="Snapshots" value={props.diff.snapshotCount} />
        <CountCard label="Observations (current)" value={props.diff.observationsCurrentCount} />
        <CountCard label="Observations (candidate)" value={props.diff.observationsCandidateCount} />
        <CountCard label="Alerts (current)" value={props.diff.alertsCurrentCount} />
        <CountCard label="Alerts (candidate)" value={props.diff.alertsCandidateCount} />
      </div>

      <div class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs-ui text-slate-700">
        <div>
          <strong class="font-semibold text-slate-900">Status:</strong>{' '}
          {props.diff.statusBefore ?? '—'} → {props.diff.statusAfter ?? '—'} (
          {props.diff.statusChanged ? 'changed' : 'same'})
        </div>
        <div class="mt-1">
          <strong class="font-semibold text-slate-900">Alerts Changed:</strong>{' '}
          {props.diff.alertsChanged ? 'yes' : 'no'}
        </div>
        <div class="mt-1">
          <strong class="font-semibold text-slate-900">Generation:</strong>{' '}
          {props.diff.currentGenerationId ?? '—'} → {props.diff.candidateGenerationId ?? '—'}
        </div>
      </div>

      <div class="mt-3 grid gap-2 xl:grid-cols-2">
        <FingerprintList
          title="Added Observation Fingerprints"
          values={props.diff.addedObservationFingerprints}
        />
        <FingerprintList
          title="Removed Observation Fingerprints"
          values={props.diff.removedObservationFingerprints}
        />
      </div>

      <section class="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <h3 class="text-xs-ui font-semibold text-slate-900">Potential Temporal Conflicts</h3>
        <Show
          when={props.diff.potentialTemporalConflicts.length > 0}
          fallback={<p class="mt-2 text-xs-ui text-slate-500">No temporal conflicts detected.</p>}
        >
          <ul class="mt-2 space-y-2 text-micro text-slate-700">
            <For each={props.diff.potentialTemporalConflicts.slice(0, 20)}>
              {(conflict) => (
                <li class="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                  <div class="font-semibold text-slate-900">{conflict.fingerprintKey}</div>
                  <div>raw_event_time: {conflict.rawEventTime ?? '—'}</div>
                  <div>before UTC: {conflict.beforeInstant ?? '—'}</div>
                  <div>after UTC: {conflict.afterInstant ?? '—'}</div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </section>
  )
}
