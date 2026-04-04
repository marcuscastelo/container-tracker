import { describe, expect, it } from 'vitest'
import {
  type TrackingValidationCopyLabels,
  toTrackingValidationIssueMetadataText,
  toTrackingValidationTooltipText,
} from '~/modules/process/ui/components/tracking-review-copy.presenter'
import type { TrackingValidationIssueVM } from '~/modules/process/ui/viewmodels/tracking-review.vm'

const labels: TrackingValidationCopyLabels = {
  areaLabel: 'Área',
  blockLabel: 'Bloco',
  locationLabel: 'Local',
  affectedAreaLabels: {
    container: 'Container',
    operational: 'Operacional',
    process: 'Processo',
    series: 'Série de eventos',
    status: 'Status',
    timeline: 'Timeline',
  },
}

function makeIssue(overrides: Partial<TrackingValidationIssueVM> = {}): TrackingValidationIssueVM {
  return {
    code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
    severity: 'warning',
    reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
    affectedArea: 'timeline',
    affectedLocation: 'Santos',
    affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
    ...overrides,
  }
}

describe('tracking-validation-copy.presenter', () => {
  it('formats shipment detail metadata from backend-derived location fields only', () => {
    expect(
      toTrackingValidationIssueMetadataText({
        issue: makeIssue(),
        labels,
        resolveBlockLabel: (key) =>
          key === 'shipmentView.timeline.blocks.postCarriage' ? 'Pós-transporte / Entrega' : key,
      }),
    ).toBe('Área: Timeline · Bloco: Pós-transporte / Entrega · Local: Santos')
  })

  it('formats the compact dashboard tooltip without exposing technical evidence', () => {
    expect(
      toTrackingValidationTooltipText({
        aggregateLabel: 'Este processo contém 1 container que requer validação',
        issue: makeIssue({
          code: 'POST_COMPLETION_TRACKING_CONTINUED',
          severity: 'danger',
          reasonKey: 'tracking.validation.postCompletionTrackingContinued',
          affectedBlockLabelKey: null,
          affectedLocation: null,
        }),
        labels,
        resolveBlockLabel: (key) => key,
        resolveReason: (key) =>
          key === 'tracking.validation.postCompletionTrackingContinued'
            ? 'O tracking continuou depois de um marco forte de conclusão.'
            : key,
      }),
    ).toBe(
      [
        'Este processo contém 1 container que requer validação',
        'O tracking continuou depois de um marco forte de conclusão.',
        'Área: Timeline',
      ].join('\n'),
    )
  })
})
