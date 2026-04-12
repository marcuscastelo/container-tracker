import { CheckCircle2, CircleAlert, OctagonAlert, X } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type {
  DashboardSyncBatchProblemTargetVM,
  DashboardSyncBatchResultVM,
} from '~/modules/process/ui/viewmodels/dashboard-sync-batch-result.vm'
import { useTranslation } from '~/shared/localization/i18n'

const VISIBLE_ITEMS_LIMIT = 5

type DashboardSyncBatchResultPanelProps = {
  readonly result: DashboardSyncBatchResultVM
  readonly onDismiss: () => void
}

type DashboardSyncBatchSectionProps = {
  readonly title: string
  readonly items: readonly DashboardSyncBatchProblemTargetVM[]
}

function toPanelToneClasses(tone: DashboardSyncBatchResultVM['tone']): string {
  if (tone === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg/45'
  }

  if (tone === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg/45'
  }

  return 'border-tone-success-border bg-tone-success-bg/40'
}

function toSummaryChipClasses(kind: 'neutral' | 'success' | 'warning' | 'danger'): string {
  if (kind === 'success') {
    return 'border-tone-success-border bg-tone-success-bg text-tone-success-fg'
  }

  if (kind === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  }

  if (kind === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }

  return 'border-border bg-surface text-text-muted'
}

function ResultToneIcon(props: { readonly tone: DashboardSyncBatchResultVM['tone'] }): JSX.Element {
  return (
    <Show
      when={props.tone === 'danger'}
      fallback={
        <Show
          when={props.tone === 'warning'}
          fallback={<CheckCircle2 class="h-5 w-5 text-tone-success-fg" aria-hidden="true" />}
        >
          <CircleAlert class="h-5 w-5 text-tone-warning-fg" aria-hidden="true" />
        </Show>
      }
    >
      <OctagonAlert class="h-5 w-5 text-tone-danger-fg" aria-hidden="true" />
    </Show>
  )
}

function DashboardSyncBatchSection(props: DashboardSyncBatchSectionProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [expanded, setExpanded] = createSignal(false)
  const visibleItems = createMemo(() =>
    expanded() ? props.items : props.items.slice(0, VISIBLE_ITEMS_LIMIT),
  )
  const remainingCount = createMemo(() => props.items.length - visibleItems().length)

  return (
    <section class="rounded-xl border border-border bg-surface/90 p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm-ui font-semibold text-foreground">{props.title}</h3>
        <Show when={props.items.length > VISIBLE_ITEMS_LIMIT}>
          <button
            type="button"
            class="text-xs-ui font-medium text-primary hover:text-primary-hover"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded()
              ? t(keys.dashboard.syncBatch.panel.showLess)
              : t(keys.dashboard.syncBatch.panel.showAll, {
                  count: remainingCount(),
                })}
          </button>
        </Show>
      </div>

      <div class="mt-3 space-y-2">
        <For each={visibleItems()}>
          {(item) => (
            <article class="rounded-lg border border-border bg-background/80 px-3 py-2">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs-ui text-text-muted">
                <span class="font-semibold text-foreground">{item.processLabel}</span>
                <span>{item.containerNumber}</span>
                <span>{item.providerLabel}</span>
              </div>
              <p class="mt-1 text-sm-ui font-medium text-foreground">{item.reasonLabel}</p>
              <p class="mt-1 text-xs-ui leading-relaxed text-text-muted">{item.reasonMessage}</p>
            </article>
          )}
        </For>
      </div>
    </section>
  )
}

export function DashboardSyncBatchResultPanel(
  props: DashboardSyncBatchResultPanelProps,
): JSX.Element {
  const { t, keys } = useTranslation()

  const headline = createMemo(() => {
    if (props.result.isBusinessError) {
      return t(keys.dashboard.syncBatch.panel.headlineNoEnqueue)
    }

    if (props.result.tone === 'warning' || props.result.tone === 'danger') {
      return t(keys.dashboard.syncBatch.panel.headlinePartial)
    }

    return t(keys.dashboard.syncBatch.panel.headlineSuccess)
  })

  return (
    <section
      class={`mb-5 rounded-2xl border p-4 shadow-sm ${toPanelToneClasses(props.result.tone)}`}
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex min-w-0 items-start gap-3">
          <ResultToneIcon tone={props.result.tone} />
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-foreground">
              {t(keys.dashboard.syncBatch.panel.title)}
            </h2>
            <p class="text-sm-ui font-medium text-foreground">{headline()}</p>
            <p class="mt-1 text-xs-ui leading-relaxed text-text-muted">
              {t(keys.dashboard.syncBatch.panel.subtitle)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => props.onDismiss()}
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:border-border-strong hover:text-foreground"
          aria-label={t(keys.dashboard.syncBatch.panel.dismiss)}
          title={t(keys.dashboard.syncBatch.panel.dismiss)}
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <span
          class={`rounded-full border px-3 py-1 text-xs-ui font-semibold ${toSummaryChipClasses('neutral')}`}
        >
          {t(keys.dashboard.syncBatch.panel.summary.requestedProcesses, {
            count: props.result.summary.requestedProcesses,
          })}
        </span>
        <span
          class={`rounded-full border px-3 py-1 text-xs-ui font-semibold ${toSummaryChipClasses('neutral')}`}
        >
          {t(keys.dashboard.syncBatch.panel.summary.requestedContainers, {
            count: props.result.summary.requestedContainers,
          })}
        </span>
        <span
          class={`rounded-full border px-3 py-1 text-xs-ui font-semibold ${toSummaryChipClasses('success')}`}
        >
          {t(keys.dashboard.syncBatch.panel.summary.enqueued, {
            count: props.result.summary.enqueued,
          })}
        </span>
        <span
          class={`rounded-full border px-3 py-1 text-xs-ui font-semibold ${toSummaryChipClasses('warning')}`}
        >
          {t(keys.dashboard.syncBatch.panel.summary.skipped, {
            count: props.result.summary.skipped,
          })}
        </span>
        <span
          class={`rounded-full border px-3 py-1 text-xs-ui font-semibold ${toSummaryChipClasses('danger')}`}
        >
          {t(keys.dashboard.syncBatch.panel.summary.failed, {
            count: props.result.summary.failed,
          })}
        </span>
      </div>

      <div class="mt-4 space-y-3">
        <Show when={props.result.failedTargets.length > 0}>
          <DashboardSyncBatchSection
            title={t(keys.dashboard.syncBatch.panel.sections.failed)}
            items={props.result.failedTargets}
          />
        </Show>
        <Show when={props.result.skippedTargets.length > 0}>
          <DashboardSyncBatchSection
            title={t(keys.dashboard.syncBatch.panel.sections.skipped)}
            items={props.result.skippedTargets}
          />
        </Show>
      </div>
    </section>
  )
}
