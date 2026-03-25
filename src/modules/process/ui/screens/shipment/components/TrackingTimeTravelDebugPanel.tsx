import { createEffect, createMemo, createSignal, type JSX, Show } from 'solid-js'
import type { TrackingReplayDebugVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly containerNumber: string | null
  readonly loading: boolean
  readonly errorMessage: string | null
  readonly debug: TrackingReplayDebugVM | null
  readonly debugPayload: unknown | null
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

function downloadDebug(containerNumber: string, snapshotId: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${containerNumber}-tracking-time-travel-${snapshotId}.json`
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function DebugMetricsGrid(props: { readonly debug: TrackingReplayDebugVM }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="grid gap-2 sm:grid-cols-4">
      <MetricCard
        label={t(keys.shipmentView.timeTravel.debugMetrics.observations)}
        value={String(props.debug.totalObservations)}
      />
      <MetricCard
        label={t(keys.shipmentView.timeTravel.debugMetrics.steps)}
        value={String(props.debug.totalSteps)}
      />
      <MetricCard
        label={t(keys.shipmentView.timeTravel.debugMetrics.status)}
        value={props.debug.checkpoint.statusCode}
      />
      <MetricCard
        label={t(keys.shipmentView.timeTravel.debugMetrics.snapshot)}
        value={String(props.debug.position)}
      />
    </div>
  )
}

type DebugStepNavigatorProps = {
  readonly debug: TrackingReplayDebugVM
  readonly selectedStepIndex: number
  readonly currentStep: TrackingReplayDebugVM['steps'][number] | null
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onSelectStep: (index: number) => void
}

function DebugStepNavigator(props: DebugStepNavigatorProps): JSX.Element {
  const { t, keys } = useTranslation()
  const stepPositionId = 'tracking-time-travel-step-position'
  const stepPositionText = () =>
    t(keys.shipmentView.timeTravel.stepPosition, {
      current: props.selectedStepIndex + 1,
      total: props.debug.steps.length,
    })

  return (
    <div class="space-y-2 rounded-md border border-border/70 bg-surface p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div id={stepPositionId} class="text-xs-ui font-medium text-foreground">
          {stepPositionText()}
        </div>
        <div class="text-xs-ui text-text-muted">
          {t(keys.shipmentView.timeTravel.debugStage, {
            stage: props.currentStep?.stage ?? 'N/A',
          })}
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
          disabled={props.selectedStepIndex <= 0}
          onClick={() => props.onPrevious()}
        >
          {t(keys.shipmentView.timeTravel.previous)}
        </button>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
          disabled={props.selectedStepIndex >= props.debug.steps.length - 1}
          onClick={() => props.onNext()}
        >
          {t(keys.shipmentView.timeTravel.next)}
        </button>
      </div>

      <input
        type="range"
        min="1"
        max={String(props.debug.steps.length)}
        value={String(props.selectedStepIndex + 1)}
        class="w-full"
        aria-labelledby={stepPositionId}
        aria-valuetext={stepPositionText()}
        onInput={(event) => props.onSelectStep(Math.max(0, Number(event.currentTarget.value) - 1))}
      />

      <Show when={props.currentStep}>{(step) => <DebugStepDetails step={step()} />}</Show>
    </div>
  )
}

function DebugStepDetails(props: {
  readonly step: TrackingReplayDebugVM['steps'][number]
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="grid gap-3 xl:grid-cols-2">
      <JsonBlock title={t(keys.shipmentView.timeTravel.debugInput)} value={props.step.input} />
      <JsonBlock title={t(keys.shipmentView.timeTravel.debugOutput)} value={props.step.output} />
      <JsonBlock
        title={t(keys.shipmentView.timeTravel.debugTimeline)}
        value={props.step.state.timeline}
      />
      <JsonBlock
        title={t(keys.shipmentView.timeTravel.debugState)}
        value={{
          status: props.step.state.status,
          alerts: props.step.state.alerts,
          observations: props.step.state.observations.length,
          series: props.step.state.series.length,
        }}
      />
    </div>
  )
}

export function TrackingTimeTravelDebugPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [selectedStepIndex, setSelectedStepIndex] = createSignal(0)

  createEffect(() => {
    if (!props.debug) return
    setSelectedStepIndex(0)
  })

  const currentStep = createMemo(() => {
    if (!props.debug) return null
    return props.debug.steps[selectedStepIndex()] ?? null
  })

  return (
    <Panel
      title={t(keys.shipmentView.timeTravel.debugTitle)}
      class="rounded-xl border-dashed"
      bodyClass="space-y-3 px-3 py-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
          disabled={!props.debugPayload || !props.debug}
          onClick={() => {
            if (!props.debugPayload || !props.debug) return
            downloadDebug(
              props.containerNumber ?? 'container',
              props.debug.snapshotId,
              props.debugPayload,
            )
          }}
        >
          {t(keys.shipmentView.timeTravel.exportDebug)}
        </button>
      </div>

      <Show when={props.loading}>
        <p class="text-xs-ui text-text-muted">{t(keys.shipmentView.timeTravel.debugLoading)}</p>
      </Show>
      <Show when={props.errorMessage}>
        {(errorMessage) => (
          <p class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-xs-ui text-tone-danger-fg">
            {t(keys.shipmentView.timeTravel.debugError)}: {errorMessage()}
          </p>
        )}
      </Show>

      <Show
        when={props.debug}
        fallback={
          <p class="text-xs-ui text-text-muted">{t(keys.shipmentView.timeTravel.debugEmpty)}</p>
        }
      >
        {(debug) => (
          <div class="space-y-3">
            <DebugMetricsGrid debug={debug()} />

            <Show when={debug().steps.length > 0}>
              <DebugStepNavigator
                debug={debug()}
                selectedStepIndex={selectedStepIndex()}
                currentStep={currentStep()}
                onPrevious={() => setSelectedStepIndex((current) => Math.max(0, current - 1))}
                onNext={() =>
                  setSelectedStepIndex((current) => Math.min(debug().steps.length - 1, current + 1))
                }
                onSelectStep={(index) => setSelectedStepIndex(index)}
              />
            </Show>
          </div>
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
