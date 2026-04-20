import type {
  TrackingValidationAffectedAreaVM,
  TrackingValidationIssueVM,
} from '~/modules/process/ui/viewmodels/tracking-review.vm'

export type TrackingValidationCopyLabels = {
  readonly areaLabel: string
  readonly blockLabel: string
  readonly locationLabel: string
  readonly affectedAreaLabels: Readonly<Record<TrackingValidationAffectedAreaVM, string>>
}

type BlockLabelResolver = (key: string) => string
type TrackingValidationLabelResolver = (key: string) => string

export function toTrackingValidationIssueMetadataText(command: {
  readonly issue: TrackingValidationIssueVM
  readonly labels: TrackingValidationCopyLabels
  readonly resolveBlockLabel: BlockLabelResolver
}): string | null {
  const parts = [
    `${command.labels.areaLabel}: ${command.labels.affectedAreaLabels[command.issue.affectedArea]}`,
  ]

  if (command.issue.affectedBlockLabelKey !== null) {
    parts.push(
      `${command.labels.blockLabel}: ${command.resolveBlockLabel(
        command.issue.affectedBlockLabelKey,
      )}`,
    )
  }

  if (command.issue.affectedLocation !== null) {
    parts.push(`${command.labels.locationLabel}: ${command.issue.affectedLocation}`)
  }

  return parts.join(' · ')
}

export function toTrackingValidationTooltipText(command: {
  readonly aggregateLabel: string
  readonly issue: TrackingValidationIssueVM | null
  readonly labels: TrackingValidationCopyLabels
  readonly resolveBlockLabel: TrackingValidationLabelResolver
  readonly resolveReason: TrackingValidationLabelResolver
}): string {
  if (command.issue === null) {
    return command.aggregateLabel
  }

  const metadata = toTrackingValidationIssueMetadataText({
    issue: command.issue,
    labels: command.labels,
    resolveBlockLabel: command.resolveBlockLabel,
  })

  return [command.aggregateLabel, command.resolveReason(command.issue.reasonKey), metadata]
    .filter(Boolean)
    .join('\n')
}
