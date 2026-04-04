import { createMemo, For, type JSX, Show } from 'solid-js'
import {
  type TrackingValidationCopyLabels,
  toTrackingValidationIssueMetadataText,
} from '~/modules/process/ui/components/tracking-review-copy.presenter'
import {
  toTrackingValidationBadgeClasses,
  toTrackingValidationDisplayState,
} from '~/modules/process/ui/components/tracking-review-display.presenter'
import type { ContainerTrackingValidationVM } from '~/modules/process/ui/viewmodels/tracking-review.vm'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly trackingValidation: ContainerTrackingValidationVM
  readonly containerNumber: string | null
  readonly mode: 'current' | 'historical'
}

type IssueCardProps = {
  readonly issue: ContainerTrackingValidationVM['activeIssues'][number]
  readonly labels: TrackingValidationCopyLabels
  readonly severityLabels: {
    readonly warning: string
    readonly danger: string
  }
}

function toSeverityLabel(
  severity: ContainerTrackingValidationVM['activeIssues'][number]['severity'],
  labels: {
    readonly warning: string
    readonly danger: string
  },
): string {
  return severity === 'danger' ? labels.danger : labels.warning
}

export function resolveTrackingValidationDetailsDescription(command: {
  readonly mode: 'current' | 'historical'
  readonly containerNumber: string | null
  readonly translate: (key: string, options?: Record<string, unknown>) => string
  readonly unknownContainerLabel: string
}): string {
  const container = command.containerNumber ?? command.unknownContainerLabel

  if (command.mode === 'historical') {
    return command.translate('shipmentView.validation.historicalDetailsDescription', {
      container,
    })
  }

  return command.translate('shipmentView.validation.detailsDescription', {
    container,
  })
}

function TrackingValidationIssueCard(props: IssueCardProps): JSX.Element {
  const { t } = useTranslation()
  const displayState = createMemo(() =>
    toTrackingValidationDisplayState({
      hasIssues: true,
      highestSeverity: props.issue.severity,
    }),
  )
  const metadata = createMemo(() =>
    toTrackingValidationIssueMetadataText({
      issue: props.issue,
      labels: props.labels,
      resolveBlockLabel: (key) => t(key),
    }),
  )

  return (
    <div class="rounded-md border border-border bg-surface px-3 py-2">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class={`inline-flex rounded-md border px-1.5 py-0.5 text-micro font-medium whitespace-nowrap ${toTrackingValidationBadgeClasses(
            displayState(),
          )}`}
        >
          {toSeverityLabel(props.issue.severity, props.severityLabels)}
        </span>
        <p class="text-xs-ui font-semibold text-foreground">{t(props.issue.reasonKey)}</p>
      </div>
      <Show when={metadata()}>
        {(text) => <p class="mt-1 text-micro text-text-muted">{text()}</p>}
      </Show>
    </div>
  )
}

export function TrackingReviewIssuesPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const issues = () => props.trackingValidation.activeIssues
  const labels = createMemo<TrackingValidationCopyLabels>(() => ({
    areaLabel: t(keys.shipmentView.validation.labels.area),
    blockLabel: t(keys.shipmentView.validation.labels.block),
    locationLabel: t(keys.shipmentView.validation.labels.location),
    affectedAreaLabels: {
      container: t(keys.shipmentView.validation.areas.container),
      operational: t(keys.shipmentView.validation.areas.operational),
      process: t(keys.shipmentView.validation.areas.process),
      series: t(keys.shipmentView.validation.areas.series),
      status: t(keys.shipmentView.validation.areas.status),
      timeline: t(keys.shipmentView.validation.areas.timeline),
    },
  }))

  const severityLabels = createMemo(() => ({
    warning: t(keys.dashboard.alertIndicators.severity.warning),
    danger: t(keys.dashboard.alertIndicators.severity.danger),
  }))

  const description = createMemo(() => {
    return resolveTrackingValidationDetailsDescription({
      mode: props.mode,
      containerNumber: props.containerNumber,
      translate: t,
      unknownContainerLabel: t(keys.shipmentView.currentStatus.unknown),
    })
  })

  return (
    <Show when={issues().length > 0}>
      <section class="mt-3 rounded-lg border border-border bg-surface-muted/60 px-3 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs-ui font-semibold text-foreground">
              {t(keys.shipmentView.validation.detailsTitle)}
            </p>
            <p class="mt-1 text-micro text-text-muted">{description()}</p>
          </div>
          <span class="rounded-md border border-border bg-surface px-1.5 py-0.5 text-micro font-medium text-text-muted">
            {issues().length}
          </span>
        </div>

        <div class="mt-3 space-y-2">
          <For each={issues()}>
            {(issue) => (
              <TrackingValidationIssueCard
                issue={issue}
                labels={labels()}
                severityLabels={severityLabels()}
              />
            )}
          </For>
        </div>
      </section>
    </Show>
  )
}
