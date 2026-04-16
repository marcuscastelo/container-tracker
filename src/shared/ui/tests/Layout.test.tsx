import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import { Panel } from '~/shared/ui/layout/Panel'
import { Stack } from '~/shared/ui/layout/Stack'

describe('Panel', () => {
  it('renders header metadata and header slot when provided', () => {
    const html = renderToString(() =>
      createComponent(Panel, {
        title: 'Overview',
        subtitle: 'Shipment metadata',
        class: 'outer-shell',
        bodyClass: 'panel-body',
        headerSlot: <button type="button">Refresh</button>,
        children: <div>Body content</div>,
      }),
    )

    expect(html).toContain('Overview')
    expect(html).toContain('Shipment metadata')
    expect(html).toContain('Refresh')
    expect(html).toContain('Body content')
    expect(html).toContain('outer-shell')
    expect(html).toContain('panel-body')
    expect(html).toContain('border-b border-border/70')
  })

  it('omits the header wrapper when no header content exists', () => {
    const html = renderToString(() =>
      createComponent(Panel, {
        children: <div>Only body</div>,
      }),
    )

    expect(html).toContain('Only body')
    expect(html).not.toContain('border-b border-border/70')
    expect(html).not.toContain('text-micro font-semibold uppercase')
  })
})

describe('Stack', () => {
  it('uses the default medium gap', () => {
    const html = renderToString(() =>
      createComponent(Stack, {
        children: <div>First</div>,
      }),
    )

    expect(html).toContain('flex flex-col gap-4')
    expect(html).toContain('First')
  })

  it('uses the requested gap size and custom class', () => {
    const html = renderToString(() =>
      createComponent(Stack, {
        gap: 'lg',
        class: 'stack-shell',
        children: <div>Second</div>,
      }),
    )

    expect(html).toContain('flex flex-col gap-6 stack-shell')
    expect(html).toContain('Second')
  })
})
