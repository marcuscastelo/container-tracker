import type { JSX } from 'solid-js'
import type { TrackingReplayTargetVM } from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.vm'

type ReplayTargetSummaryViewProps = {
  readonly target: TrackingReplayTargetVM
}

function SummaryLine(props: {
  readonly label: string
  readonly value: string | number
}): JSX.Element {
  return (
    <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div class="text-micro uppercase tracking-wide text-slate-500">{props.label}</div>
      <div class="mt-1 break-all text-xs-ui text-slate-900">{props.value}</div>
    </div>
  )
}

function nullableValue(value: string | null): string {
  return value ?? '—'
}

export function ReplayTargetSummaryView(props: ReplayTargetSummaryViewProps): JSX.Element {
  return (
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Replay Target Summary</h2>
      <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryLine label="Container" value={props.target.containerNumber} />
        <SummaryLine label="Container ID" value={props.target.containerId} />
        <SummaryLine label="Provider" value={nullableValue(props.target.provider)} />
        <SummaryLine label="Process" value={nullableValue(props.target.processReference)} />
        <SummaryLine label="Process ID" value={nullableValue(props.target.processId)} />
        <SummaryLine label="Snapshots" value={props.target.snapshotCount} />
        <SummaryLine
          label="Active Generation"
          value={nullableValue(props.target.activeGenerationId)}
        />
        <SummaryLine
          label="Previous Generation"
          value={nullableValue(props.target.previousGenerationId)}
        />
        <SummaryLine
          label="Last Replay Run"
          value={nullableValue(props.target.lastReplayRun?.runId ?? null)}
        />
      </div>
    </section>
  )
}
