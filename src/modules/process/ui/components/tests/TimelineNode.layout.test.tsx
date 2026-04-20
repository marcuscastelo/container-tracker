import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-solid', () => ({
  EyeIcon: () => null,
  TriangleAlert: () => null,
}))

import { TimelineNodeLayout } from '~/modules/process/ui/TimelineNode.layout'

type LayoutOverrides = Partial<Parameters<typeof TimelineNodeLayout>[0]>

function renderLayout(overrides: LayoutOverrides = {}): string {
  return renderToString(() =>
    createComponent(TimelineNodeLayout, {
      isLast: false,
      isExpected: false,
      isExpiredExpected: false,
      hasSeriesConflict: false,
      hasValidationWarning: false,
      dotClass: 'dot-base',
      lineClass: 'line-base',
      textClass: 'text-base',
      label: 'Departure',
      showPredictionHistoryButton: false,
      onOpenPredictionHistory: () => undefined,
      predictionHistoryLabel: 'Prediction history',
      showObservationButton: false,
      onOpenObservation: () => undefined,
      observationLabel: 'Observation',
      conflictBadgeLabel: 'Conflito',
      conflictTooltip: 'Série com conflito de dados',
      expiredExpectedLabel: 'Expirado',
      expiredExpectedTooltip: 'Tooltip expirado',
      expectedLabel: 'Previsto',
      predictedTooltip: 'Tooltip previsto',
      etaChipLabel: null,
      location: 'Santos, BR',
      dateLabel: '2026-04-10',
      carrierLink: null,
      ...overrides,
    }),
  )
}

describe('TimelineNode.layout', () => {
  it('renders dedicated conflict emphasis without legacy warning background', () => {
    const html = renderLayout({
      hasSeriesConflict: true,
    })

    expect(html).toContain('Conflito')
    expect(html).toContain('ring-1 ring-inset ring-tone-warning-border/70')
    expect(html).toContain('ring-2 ring-tone-warning-border/45 ring-offset-1 ring-offset-surface')
    expect(html).not.toContain('bg-tone-warning-bg/60')
  })

  it('keeps expected nodes visually neutral when no conflict exists', () => {
    const html = renderLayout({
      isExpected: true,
      label: 'Arrival',
    })

    expect(html).toContain('opacity-70')
    expect(html).not.toContain('Conflito')
    expect(html).not.toContain('ring-tone-warning-border/70')
  })

  it('shows expired expected and conflict markers together', () => {
    const html = renderLayout({
      isExpected: true,
      isExpiredExpected: true,
      hasSeriesConflict: true,
      label: 'Discharge',
    })

    expect(html).toContain('Expirado')
    expect(html).toContain('Conflito')
    expect(html).toContain('opacity-45')
  })
})
