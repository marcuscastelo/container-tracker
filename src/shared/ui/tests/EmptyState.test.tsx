import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from '~/shared/ui/EmptyState'

describe('EmptyState', () => {
  it('renders title and description without an action button by default', () => {
    const html = renderToString(() =>
      createComponent(EmptyState, {
        title: 'No results found',
        description: 'Try a different search term',
      }),
    )

    expect(html).toContain('No results found')
    expect(html).toContain('Try a different search term')
    expect(html).not.toContain('<button')
  })

  it('renders an action button only when both label and callback are provided', () => {
    const onAction = vi.fn()
    const html = renderToString(() =>
      createComponent(EmptyState, {
        title: 'No shipments yet',
        description: 'Create your first shipment to get started',
        actionLabel: 'Create shipment',
        onAction,
      }),
    )

    expect(html).toContain('Create shipment')
    expect(html).toContain('<button')
    expect(onAction).not.toHaveBeenCalled()
  })

  it('does not render an action button when the label exists without a callback', () => {
    const html = renderToString(() =>
      createComponent(EmptyState, {
        title: 'Nothing here',
        description: 'Waiting for data',
        actionLabel: 'Retry',
      }),
    )

    expect(html).toContain('Nothing here')
    expect(html).not.toContain('<button')
  })
})
