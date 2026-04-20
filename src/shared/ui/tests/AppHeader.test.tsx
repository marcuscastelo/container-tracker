import { createComponent, type JSX } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockLocationState = {
  pathname: string
}

type MockThemeState = {
  current: 'light' | 'dark'
}

const locationState = vi.hoisted<MockLocationState>(() => ({
  pathname: '/',
}))

const themeState = vi.hoisted<MockThemeState>(() => ({
  current: 'light',
}))

const translationKeys = vi.hoisted(() => ({
  header: {
    nav: {
      dashboard: 'header.nav.dashboard',
      agents: 'header.nav.agents',
    },
    createProcess: 'header.createProcess',
    logout: 'header.logout',
    theme: {
      switchToLight: 'header.theme.switchToLight',
      switchToDark: 'header.theme.switchToDark',
    },
  },
}))

function translate(value: string): string {
  switch (value) {
    case 'header.nav.dashboard':
      return 'Dashboard'
    case 'header.nav.agents':
      return 'Agents'
    case 'header.createProcess':
      return 'Create process'
    case 'header.logout':
      return 'Logout'
    case 'header.theme.switchToLight':
      return 'Switch to light theme'
    case 'header.theme.switchToDark':
      return 'Switch to dark theme'
    default:
      return value
  }
}

function normalizeSsrHtml(html: string): string {
  return html.replaceAll('<!--$-->', '').replaceAll('<!--/-->', '')
}

vi.mock('@solidjs/router', () => ({
  A: (props: {
    readonly href: string
    readonly children?: JSX.Element
    readonly class?: string
    readonly end?: boolean
    readonly noScroll?: boolean
    readonly 'aria-label'?: string
  }) => (
    <a
      href={props.href}
      class={props.class}
      aria-label={props['aria-label']}
      data-end={props.end ? 'true' : undefined}
      data-no-scroll={props.noScroll ? 'true' : undefined}
    >
      {props.children}
    </a>
  ),
  useLocation: () => locationState,
}))

vi.mock('lucide-solid', () => ({
  Moon: (props: {
    readonly class?: string
    readonly 'aria-hidden'?: boolean | 'true' | 'false'
  }) => <svg data-icon="moon" class={props.class} aria-hidden={props['aria-hidden']} />,
  Sun: (props: {
    readonly class?: string
    readonly 'aria-hidden'?: boolean | 'true' | 'false'
  }) => <svg data-icon="sun" class={props.class} aria-hidden={props['aria-hidden']} />,
}))

vi.mock('~/lib/theme', () => ({
  getTheme: () => themeState.current,
  toggleTheme: () => {
    themeState.current = themeState.current === 'dark' ? 'light' : 'dark'
    return themeState.current
  },
}))

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    t: translate,
    keys: translationKeys,
  }),
}))

vi.mock('~/shared/ui/navbar-alerts/NavbarAlertsButton', () => ({
  NavbarAlertsButton: () => <div>mock-navbar-alerts</div>,
}))

import { AppHeader } from '~/shared/ui/AppHeader'

describe('AppHeader', () => {
  beforeEach(() => {
    locationState.pathname = '/'
    themeState.current = 'light'
  })

  it('renders brand, active dashboard navigation, and optional slots', () => {
    const html = normalizeSsrHtml(
      renderToString(() =>
        createComponent(AppHeader, {
          preserveDashboardScroll: true,
          onCreateProcess: () => undefined,
          onDashboardIntent: () => undefined,
          searchSlot: (
            <button type="button" data-search-trigger="true">
              Search shipments
            </button>
          ),
          syncSlot: <div>Sync status</div>,
          actionsSlot: <button type="button">Open menu</button>,
        }),
      ),
    )

    expect(html).toContain('Container Tracker')
    expect(html).toContain('Castro Aduaneira')
    expect(html).toContain('/branding/logo-light.png')
    expect(html).toContain('/branding/logo-dark.png')
    expect(html).toContain('aria-label="Castro Aduaneira — Container Tracker"')
    expect(html).toMatch(/href="\/"[^>]*before:bg-primary/)
    expect(html).toContain('Search shipments')
    expect(html).toContain('Sync status')
    expect(html).toContain('Open menu')
    expect(html).toContain('Create process')
    expect(html).toContain('Logout')
    expect(html).toContain('href="/auth/logout"')
    expect(html).toContain('mock-navbar-alerts')
    expect(html).toContain('aria-label="Switch to dark theme"')
    expect(html).toContain('data-icon="moon"')
    expect(html.match(/data-no-scroll="true"/g)?.length ?? 0).toBe(2)
  })

  it('renders dark theme controls and omits optional slots when they are absent', () => {
    locationState.pathname = '/agents'
    themeState.current = 'dark'

    const html = normalizeSsrHtml(
      renderToString(() =>
        createComponent(AppHeader, {
          searchSlot: undefined,
          syncSlot: undefined,
          actionsSlot: undefined,
        }),
      ),
    )

    expect(html).toContain('Dashboard')
    expect(html).toMatch(/href="\/agents"[^>]*before:bg-primary/)
    expect(html).toContain('mock-navbar-alerts')
    expect(html).toContain('aria-label="Switch to light theme"')
    expect(html).toContain('data-icon="sun"')
    expect(html).not.toContain('Search shipments')
    expect(html).not.toContain('Sync status')
    expect(html).not.toContain('Open menu')
    expect(html).not.toContain('Create process')
    expect(html).toContain('Logout')
    expect(html).toContain('href="/auth/logout"')
    expect(html).not.toContain('data-no-scroll="true"')
  })
})
