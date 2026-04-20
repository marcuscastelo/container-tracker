import { createComponent, type JSX } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

const locationState = vi.hoisted(() => ({
  pathname: '/',
}))

const translationKeys = vi.hoisted(() => ({
  createProcess: {
    action: {
      existingProcessSame: 'createProcess.action.existingProcessSame',
      existingProcessError: 'createProcess.action.existingProcessError',
      existingProcessLink: 'createProcess.action.existingProcessLink',
      dismiss: 'createProcess.action.dismiss',
    },
  },
}))

vi.mock('@solidjs/router', () => ({
  A: (props: { readonly href: string; readonly children?: JSX.Element }) => (
    <a href={props.href}>{props.children}</a>
  ),
  useLocation: () => ({
    pathname: locationState.pathname,
    search: '',
    hash: '',
    state: null,
    query: {},
  }),
}))

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    t: (value: string, params?: Readonly<Record<string, unknown>>) => {
      if (value === 'createProcess.action.existingProcessSame') {
        return `same:${String(params?.container ?? '')}`
      }
      if (value === 'createProcess.action.existingProcessError') {
        return `existing:${String(params?.container ?? '')}`
      }
      if (value === 'createProcess.action.existingProcessLink') {
        return 'Open existing process'
      }
      if (value === 'createProcess.action.dismiss') {
        return 'Dismiss duplicate warning'
      }
      return value
    },
    keys: translationKeys,
  }),
}))

vi.mock('~/shared/ui/navigation/app-navigation', () => ({
  toInternalAppPathname: (value: string) => value.split('?')[0]?.split('#')[0] ?? '',
}))

describe('ExistingProcessError', () => {
  it('renders the same-process message and hides the link when already on the target page', () => {
    locationState.pathname = '/shipments/process-1'

    const html = renderToString(() =>
      createComponent(ExistingProcessError, {
        existing: {
          processId: 'process-1',
          containerNumber: 'MSCU1234567',
          link: '/shipments/process-1?tab=alerts',
        },
      }),
    )

    expect(html).toContain('same:MSCU1234567')
    expect(html).toContain('aria-label="Dismiss duplicate warning"')
    expect(html).not.toContain('Open existing process')
  })

  it('renders the existing-process message with extracted container number and link to the other process', () => {
    locationState.pathname = '/shipments/current'

    const html = renderToString(() =>
      createComponent(ExistingProcessError, {
        message: 'Container MSCU7654321 already belongs to another shipment.',
        existing: {
          processId: 'process-2',
        },
      }),
    )

    expect(html).toContain('existing:MSCU7654321')
    expect(html).toContain('href="/shipments/process-2"')
    expect(html).toContain('Open existing process')
  })

  it('falls back to the raw message when no existing container context is available', () => {
    locationState.pathname = '/shipments/current'

    const html = renderToString(() =>
      createComponent(ExistingProcessError, {
        message: 'Duplicate shipment detected.',
        existing: null,
      }),
    )

    expect(html).toContain('Duplicate shipment detected.')
    expect(html).not.toContain('Open existing process')
  })
})
