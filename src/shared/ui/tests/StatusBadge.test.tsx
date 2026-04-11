import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { StatusBadge } from '~/shared/ui/StatusBadge'

vi.mock('lucide-solid', () => ({
  Check: () => '<check-icon />',
  Circle: () => '<circle-icon />',
  CircleDot: () => '<circle-dot-icon />',
  Minus: () => '<minus-icon />',
}))

describe('StatusBadge', () => {
  it('renders transit variants with the operational transit color group', () => {
    const html = renderToString(() =>
      createComponent(StatusBadge, {
        variant: 'in-transit',
        label: 'Em trânsito',
      }),
    )

    expect(html).toContain('Em trânsito')
    expect(html).toContain('--color-status-in-transit-bg')
    expect(html).toContain('circle-icon')
  })

  it('renders delivered variants with the cleared color group and check icon', () => {
    const html = renderToString(() =>
      createComponent(StatusBadge, {
        variant: 'delivered',
        label: 'Entregue',
      }),
    )

    expect(html).toContain('Entregue')
    expect(html).toContain('--color-status-cleared-bg')
    expect(html).toContain('check-icon')
  })

  it('renders partial variants with the discharged color group and partial icon', () => {
    const html = renderToString(() =>
      createComponent(StatusBadge, {
        variant: 'partial',
        label: 'Parcial',
      }),
    )

    expect(html).toContain('Parcial')
    expect(html).toContain('--color-status-discharged-bg')
    expect(html).toContain('circle-dot-icon')
  })

  it('renders unknown variants with neutral fallback classes and dash icon', () => {
    const html = renderToString(() =>
      createComponent(StatusBadge, {
        variant: 'unknown',
        label: 'Desconhecido',
      }),
    )

    expect(html).toContain('Desconhecido')
    expect(html).toContain('border-border bg-surface-muted text-text-muted')
    expect(html).toContain('minus-icon')
  })

  it('supports micro badges and hidden icons for compact layouts', () => {
    const html = renderToString(() =>
      createComponent(StatusBadge, {
        variant: 'delayed',
        label: 'Atrasado',
        size: 'micro',
        hideIcon: true,
      }),
    )

    expect(html).toContain('Atrasado')
    expect(html).toContain('text-micro')
    expect(html).toContain('truncate max-w-[11rem]')
    expect(html).not.toContain('icon')
  })

  it('lets neutral mode override semantic colors without dropping the icon', () => {
    const html = renderToString(() =>
      createComponent(StatusBadge, {
        variant: 'delivered',
        label: 'Entregue',
        neutral: true,
      }),
    )

    expect(html).toContain('border-border bg-surface-muted text-text-muted')
    expect(html).toContain('check-icon')
  })
})
