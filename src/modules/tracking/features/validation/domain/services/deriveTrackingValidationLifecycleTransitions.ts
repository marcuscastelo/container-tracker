import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import type {
  TrackingValidationLifecycleState,
  TrackingValidationLifecycleTransition,
  TrackingValidationLifecycleTransitionContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'

type LifecycleComparableFinding = Pick<
  TrackingValidationFinding,
  | 'lifecycleKey'
  | 'stateFingerprint'
  | 'code'
  | 'detectorId'
  | 'detectorVersion'
  | 'affectedScope'
  | 'severity'
  | 'evidenceSummary'
>

function toTransitionFromFinding(command: {
  readonly finding: LifecycleComparableFinding
  readonly transitionType: TrackingValidationLifecycleTransition['transitionType']
  readonly context: TrackingValidationLifecycleTransitionContext
}): TrackingValidationLifecycleTransition {
  return {
    containerId: command.context.containerId,
    transitionType: command.transitionType,
    lifecycleKey: command.finding.lifecycleKey,
    issueCode: command.finding.code,
    detectorId: command.finding.detectorId,
    detectorVersion: command.finding.detectorVersion,
    affectedScope: command.finding.affectedScope,
    severity: command.finding.severity,
    stateFingerprint: command.finding.stateFingerprint,
    evidenceSummary: command.finding.evidenceSummary,
    provider: command.context.provider,
    snapshotId: command.context.snapshotId,
    occurredAt: command.context.occurredAt,
  }
}

function toTransitionFromState(command: {
  readonly state: TrackingValidationLifecycleState
  readonly context: TrackingValidationLifecycleTransitionContext
}): TrackingValidationLifecycleTransition {
  return {
    containerId: command.context.containerId,
    transitionType: 'resolved',
    lifecycleKey: command.state.lifecycleKey,
    issueCode: command.state.issueCode,
    detectorId: command.state.detectorId,
    detectorVersion: command.state.detectorVersion,
    affectedScope: command.state.affectedScope,
    severity: command.state.severity,
    stateFingerprint: command.state.stateFingerprint,
    evidenceSummary: command.state.evidenceSummary,
    provider: command.context.provider,
    snapshotId: command.context.snapshotId,
    occurredAt: command.context.occurredAt,
  }
}

function createStateByLifecycleKey(
  states: readonly TrackingValidationLifecycleState[],
): ReadonlyMap<string, TrackingValidationLifecycleState> {
  const byLifecycleKey = new Map<string, TrackingValidationLifecycleState>()

  for (const state of states) {
    if (byLifecycleKey.has(state.lifecycleKey)) {
      throw new Error(
        `tracking validation lifecycle: duplicate persisted active state for key ${state.lifecycleKey}`,
      )
    }

    byLifecycleKey.set(state.lifecycleKey, state)
  }

  return byLifecycleKey
}

function createFindingByLifecycleKey(
  findings: readonly LifecycleComparableFinding[],
): ReadonlyMap<string, LifecycleComparableFinding> {
  const byLifecycleKey = new Map<string, LifecycleComparableFinding>()

  for (const finding of findings) {
    if (byLifecycleKey.has(finding.lifecycleKey)) {
      throw new Error(
        `tracking validation lifecycle: duplicate active finding for key ${finding.lifecycleKey}`,
      )
    }

    byLifecycleKey.set(finding.lifecycleKey, finding)
  }

  return byLifecycleKey
}

export function deriveTrackingValidationLifecycleTransitions(command: {
  readonly activeFindings: readonly TrackingValidationFinding[]
  readonly existingActiveStates: readonly TrackingValidationLifecycleState[]
  readonly context: TrackingValidationLifecycleTransitionContext
}): readonly TrackingValidationLifecycleTransition[] {
  const activeFindings = command.activeFindings.filter((finding) => finding.isActive)
  const existingByLifecycleKey = createStateByLifecycleKey(command.existingActiveStates)
  const currentByLifecycleKey = createFindingByLifecycleKey(activeFindings)
  const transitions: TrackingValidationLifecycleTransition[] = []

  for (const finding of activeFindings) {
    const existing = existingByLifecycleKey.get(finding.lifecycleKey)
    if (existing === undefined) {
      transitions.push(
        toTransitionFromFinding({
          finding,
          transitionType: 'activated',
          context: command.context,
        }),
      )
      continue
    }

    if (existing.stateFingerprint !== finding.stateFingerprint) {
      transitions.push(
        toTransitionFromFinding({
          finding,
          transitionType: 'changed',
          context: command.context,
        }),
      )
    }
  }

  const resolvedStates = [...command.existingActiveStates]
    .filter((state) => !currentByLifecycleKey.has(state.lifecycleKey))
    .sort((left, right) => left.lifecycleKey.localeCompare(right.lifecycleKey))

  for (const state of resolvedStates) {
    transitions.push(
      toTransitionFromState({
        state,
        context: command.context,
      }),
    )
  }

  return transitions
}
