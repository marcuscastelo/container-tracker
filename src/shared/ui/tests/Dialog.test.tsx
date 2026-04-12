import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from '~/shared/ui/Dialog'

const translationKeys = vi.hoisted(() => ({
  dialog: {
    close: 'dialog.close',
  },
}))

vi.mock('solid-js/web', async () => {
  const actual = await vi.importActual<typeof import('solid-js/web')>('solid-js/web')

  return {
    ...actual,
    Portal: (props: { readonly children?: unknown }) => <>{props.children}</>,
  }
})

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    t: (value: string) => {
      if (value === 'dialog.close') return 'Close dialog'
      return value
    },
    keys: translationKeys,
  }),
}))

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    const html = renderToString(() =>
      createComponent(Dialog, {
        open: false,
        onClose: () => undefined,
        title: 'Export data',
        children: <div>Dialog body</div>,
      }),
    )

    expect(html).toBe('')
  })

  it('renders title, description, content, and width class when open', () => {
    const html = renderToString(() =>
      createComponent(Dialog, {
        open: true,
        onClose: () => undefined,
        title: 'Export data',
        description: 'Choose the export format',
        maxWidth: '2xl',
        children: <div>Dialog body</div>,
      }),
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('Export data')
    expect(html).toContain('Choose the export format')
    expect(html).toContain('Dialog body')
    expect(html).toContain('aria-label="Close dialog"')
    expect(html).toContain('max-w-2xl')
    expect(html).toContain('motion-dialog-panel')
    expect(html).toContain('motion-dialog-overlay')
  })

  it('falls back to lg width and omits description when not provided', () => {
    const html = renderToString(() =>
      createComponent(Dialog, {
        open: true,
        onClose: () => undefined,
        title: 'Import bundle',
        children: <div>Import body</div>,
      }),
    )

    expect(html).toContain('Import bundle')
    expect(html).toContain('Import body')
    expect(html).toContain('max-w-lg')
    expect(html).not.toContain('mt-1 text-md-ui text-text-muted')
  })
})
