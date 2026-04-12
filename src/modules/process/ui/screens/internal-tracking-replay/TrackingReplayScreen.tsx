import { A } from '@solidjs/router'
import { type JSX, onCleanup, onMount, Show } from 'solid-js'
import { ReplayActionsView } from '~/modules/process/ui/screens/internal-tracking-replay/components/ReplayActionsView'
import { ReplayDiffSummaryView } from '~/modules/process/ui/screens/internal-tracking-replay/components/ReplayDiffSummaryView'
import { ReplayRunSummaryView } from '~/modules/process/ui/screens/internal-tracking-replay/components/ReplayRunSummaryView'
import { ReplayTargetLookupView } from '~/modules/process/ui/screens/internal-tracking-replay/components/ReplayTargetLookupView'
import { ReplayTargetSummaryView } from '~/modules/process/ui/screens/internal-tracking-replay/components/ReplayTargetSummaryView'
import { useTrackingReplayController } from '~/modules/process/ui/screens/internal-tracking-replay/hooks/useTrackingReplayController'

function setNoIndexMetaTag(): () => void {
  if (typeof document === 'undefined') {
    return () => undefined
  }

  const existing = document.head.querySelector('meta[name="robots"]')
  const hadExisting = existing !== null
  const previousContent = existing?.getAttribute('content') ?? null
  const target = existing ?? document.createElement('meta')

  if (!hadExisting) {
    target.setAttribute('name', 'robots')
    document.head.append(target)
  }

  target.setAttribute('content', 'noindex,nofollow')

  return () => {
    if (!hadExisting) {
      target.remove()
      return
    }

    if (previousContent === null) {
      target.removeAttribute('content')
      return
    }

    target.setAttribute('content', previousContent)
  }
}

function InternalReplayNotFoundView(): JSX.Element {
  return (
    <main class="mx-auto max-w-xl px-4 py-12">
      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <h1 class="text-lg-ui font-semibold text-slate-900">Not found</h1>
        <p class="mt-2 text-xs-ui text-slate-600">
          Internal tracking replay is disabled. Enable
          <code class="mx-1 rounded bg-slate-100 px-1 py-0.5 text-micro">
            ENABLE_INTERNAL_TRACKING_REPLAY_UI=true
          </code>
          on server environment.
        </p>
        <A class="mt-4 inline-block text-xs-ui font-medium text-blue-700 underline" href="/">
          Back to Dashboard
        </A>
      </section>
    </main>
  )
}

export function TrackingReplayScreen(): JSX.Element {
  const controller = useTrackingReplayController()

  onMount(() => {
    const cleanup = setNoIndexMetaTag()
    onCleanup(cleanup)
  })

  return (
    <Show when={!controller.isDisabled()} fallback={<InternalReplayNotFoundView />}>
      <div class="min-h-screen bg-slate-100">
        <main class="mx-auto max-w-300 space-y-4 px-3 py-4 sm:px-4 lg:px-6">
          <header class="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div class="text-micro font-semibold uppercase tracking-wide text-amber-900">
              Internal Tool
            </div>
            <h1 class="mt-1 text-lg-ui font-semibold text-amber-950">Tracking Replay Engine</h1>
            <p class="mt-1 text-xs-ui text-amber-800">
              Administrative replay by container with preview, apply, rollback and diff summary.
            </p>
          </header>

          <ReplayTargetLookupView
            containerNumber={controller.containerNumberInput()}
            busy={controller.busyAction() === 'lookup'}
            onContainerNumberInput={controller.setContainerNumberInput}
            onLookup={controller.lookup}
          />

          <Show when={controller.errorMessage()}>
            {(message) => (
              <section class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs-ui text-rose-700">
                {message()}
              </section>
            )}
          </Show>

          <Show when={controller.state() === 'loading'}>
            <section class="rounded-xl border border-slate-200 bg-white p-4 text-xs-ui text-slate-500">
              Checking internal replay availability...
            </section>
          </Show>

          <Show when={controller.state() === 'empty'}>
            <section class="rounded-xl border border-slate-200 bg-white p-4 text-xs-ui text-slate-500">
              Lookup a container to start preview/apply/rollback operations.
            </section>
          </Show>

          <Show when={controller.state() === 'ready'}>
            <Show when={controller.target()}>
              {(target) => (
                <>
                  <ReplayTargetSummaryView target={target()} />
                  <ReplayActionsView
                    reason={controller.reasonInput()}
                    busyAction={controller.busyAction()}
                    onReasonInput={controller.setReasonInput}
                    onPreview={controller.preview}
                    onApply={controller.apply}
                    onRollback={controller.rollback}
                  />

                  <Show when={controller.currentRun()}>
                    {(run) => <ReplayRunSummaryView run={run()} />}
                  </Show>

                  <Show when={controller.diff()}>
                    {(diff) => <ReplayDiffSummaryView diff={diff()} />}
                  </Show>
                </>
              )}
            </Show>
          </Show>
        </main>
      </div>
    </Show>
  )
}
