import type { JSX } from 'solid-js'
import type { TrackingReplayRunVM } from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.vm'

type ReplayRunSummaryViewProps = {
  readonly run: TrackingReplayRunVM
}

function toBadgeClass(status: string): string {
  if (status === 'FAILED') return 'border-rose-300 bg-rose-50 text-rose-700'
  if (status === 'APPLIED' || status === 'ROLLED_BACK') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  }

  return 'border-slate-300 bg-slate-50 text-slate-700'
}

function Field(props: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div>
      <dt class="text-micro uppercase tracking-wide text-slate-500">{props.label}</dt>
      <dd class="mt-1 break-all text-xs-ui text-slate-900">{props.value}</dd>
    </div>
  )
}

export function ReplayRunSummaryView(props: ReplayRunSummaryViewProps): JSX.Element {
  return (
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm-ui font-semibold text-slate-900">Replay Run</h2>
        <span
          class={`rounded-full border px-2 py-1 text-micro font-semibold ${toBadgeClass(props.run.status)}`}
        >
          {props.run.status}
        </span>
      </div>

      <dl class="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Run ID" value={props.run.runId} />
        <Field label="Mode" value={props.run.mode} />
        <Field label="Requested By" value={props.run.requestedBy} />
        <Field label="Created At" value={props.run.createdAt} />
        <Field label="Started At" value={props.run.startedAt ?? '—'} />
        <Field label="Finished At" value={props.run.finishedAt ?? '—'} />
      </dl>

      <div class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs-ui text-slate-700">
        <strong class="font-semibold text-slate-900">Error:</strong>{' '}
        {props.run.errorMessage ?? 'none'}
      </div>
    </section>
  )
}
