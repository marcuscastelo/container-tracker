import type { JSX } from 'solid-js'

type ReplayActionsViewProps = {
  readonly reason: string
  readonly busyAction: 'lookup' | 'preview' | 'apply' | 'rollback' | null
  readonly onReasonInput: (value: string) => void
  readonly onPreview: () => Promise<void>
  readonly onApply: () => Promise<void>
  readonly onRollback: () => Promise<void>
}

function ActionButton(props: {
  readonly label: string
  readonly busyLabel: string
  readonly tone: 'neutral' | 'danger'
  readonly active: boolean
  readonly disabled: boolean
  readonly onClick: () => Promise<void>
}): JSX.Element {
  const classByTone = () =>
    props.tone === 'danger'
      ? 'border-rose-300 bg-rose-50 text-rose-700'
      : 'border-slate-300 bg-white text-slate-800'

  return (
    <button
      type="button"
      class={`rounded-md border px-3 py-2 text-xs-ui font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${classByTone()}`}
      disabled={props.disabled}
      onClick={() => {
        void props.onClick()
      }}
    >
      {props.active ? props.busyLabel : props.label}
    </button>
  )
}

export function ReplayActionsView(props: ReplayActionsViewProps): JSX.Element {
  const isActionBusy = () => props.busyAction !== null && props.busyAction !== 'lookup'

  return (
    <section class="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 class="text-sm-ui font-semibold text-amber-950">Internal Tool Actions</h2>
      <p class="mt-1 text-xs-ui text-amber-800">
        Preview, apply and rollback operate directly on tracking generations.
      </p>
      <label
        class="mt-3 block text-micro uppercase tracking-wide text-amber-900"
        for="replay-reason"
      >
        Reason (optional)
      </label>
      <textarea
        id="replay-reason"
        rows={3}
        class="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-xs-ui text-slate-900 outline-none ring-blue-500 focus:ring-2"
        value={props.reason}
        onInput={(event) => props.onReasonInput(event.currentTarget.value)}
        placeholder="Why are you replaying this container?"
      />

      <div class="mt-3 flex flex-wrap gap-2">
        <ActionButton
          label="Preview"
          busyLabel="Running preview..."
          tone="neutral"
          active={props.busyAction === 'preview'}
          disabled={isActionBusy()}
          onClick={props.onPreview}
        />
        <ActionButton
          label="Apply"
          busyLabel="Applying..."
          tone="neutral"
          active={props.busyAction === 'apply'}
          disabled={isActionBusy()}
          onClick={props.onApply}
        />
        <ActionButton
          label="Rollback"
          busyLabel="Rolling back..."
          tone="danger"
          active={props.busyAction === 'rollback'}
          disabled={isActionBusy()}
          onClick={props.onRollback}
        />
      </div>
    </section>
  )
}
