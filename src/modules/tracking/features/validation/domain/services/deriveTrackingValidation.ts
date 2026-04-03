import type { TrackingValidationContext } from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'
import {
  createEmptyTrackingValidationContainerSummary,
  pickHighestTrackingValidationSeverity,
  type TrackingValidationContainerSummary,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'
import type { TrackingValidationRegistry } from '~/modules/tracking/features/validation/domain/registry/trackingValidationRegistry'

export type TrackingValidationDerivation = {
  readonly findings: readonly TrackingValidationFinding[]
  readonly summary: TrackingValidationContainerSummary
}

export function deriveTrackingValidation(command: {
  readonly context: TrackingValidationContext
  readonly registry: TrackingValidationRegistry
}): TrackingValidationDerivation {
  const findings = command.registry.evaluate(command.context)

  if (findings.length === 0) {
    return {
      findings,
      summary: createEmptyTrackingValidationContainerSummary(),
    }
  }

  let highestSeverity: TrackingValidationSeverity | null = null
  for (const finding of findings) {
    highestSeverity = pickHighestTrackingValidationSeverity(highestSeverity, finding.severity)
  }

  return {
    findings,
    summary: {
      hasIssues: true,
      findingCount: findings.length,
      highestSeverity,
    },
  }
}
