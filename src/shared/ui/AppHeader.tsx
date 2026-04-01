import { A, useLocation } from '@solidjs/router'
import clsx from 'clsx'
import { Moon, Sun } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { getTheme, toggleTheme, type UiTheme } from '~/lib/theme'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { LanguageSwitch } from '~/shared/ui/LanguageSwitch'
import { NavbarAlertsButton } from '~/shared/ui/navbar-alerts/NavbarAlertsButton'

type Props = {
  readonly onCreateProcess?: () => void
  readonly searchSlot?: JSX.Element
  readonly syncSlot?: JSX.Element
  readonly actionsSlot?: JSX.Element
}

const OUTLINE_BUTTON_CLASS =
  'inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] items-center justify-center gap-2 rounded-[var(--dashboard-control-radius)] border border-border bg-surface px-3 text-sm-ui font-medium text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

function NavLink(props: {
  readonly href: string
  readonly children: JSX.Element
  readonly end?: boolean
}): JSX.Element {
  const location = useLocation()
  const pathname = location.pathname
  const startsWith = () => pathname.startsWith(props.href)
  const equals = () => pathname === props.href

  const isActive = () => (props.end ? equals() : equals() || startsWith())

  const activeClass =
    'text-primary before:absolute before:inset-x-0 before:-bottom-1 before:h-0.5 before:rounded before:bg-primary'
  const mutedClass = 'text-text-muted'

  return (
    <A
      href={props.href}
      end={props.end}
      class={clsx(
        'relative px-1 py-2 text-sm-ui font-medium transition-colors hover:text-primary',
        {
          [activeClass]: isActive(),
          [mutedClass]: !isActive() && !(props.end && startsWith),
        },
      )}
    >
      {props.children}
    </A>
  )
}

function HeaderBrand(): JSX.Element {
  const isDark = () => getTheme() === 'dark'

  return (
    <A
      href="/"
      class="flex min-w-0 items-center gap-3 text-primary"
      aria-label={BRANDING.displayTitle}
    >
      <span class="relative block h-10 w-10 shrink-0 overflow-hidden">
        <img
          src={BRANDING.logoPrimaryLight}
          alt={BRANDING.companyName}
          class={clsx(
            'absolute inset-0 block h-10 w-auto object-contain transition-all duration-200 ease-out',
            {
              'opacity-100 scale-100': !isDark(),
              'opacity-0 scale-95': isDark(),
            },
          )}
        />
        <img
          src={BRANDING.logoPrimaryDark}
          alt=""
          aria-hidden="true"
          class={clsx(
            'absolute inset-0 block h-10 w-auto object-contain transition-all duration-200 ease-out',
            {
              'opacity-100 scale-100': isDark(),
              'opacity-0 scale-95': !isDark(),
            },
          )}
        />
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-lg-ui font-semibold leading-tight tracking-[-0.01em]">
          {BRANDING.productName}
        </span>
        <span class="truncate text-xs-ui font-medium text-text-muted max-[1279px]:hidden">
          {BRANDING.companyName}
        </span>
      </span>
    </A>
  )
}

function HeaderNavigation(props: {
  readonly dashboardLabel: string
  readonly agentsLabel: string
}): JSX.Element {
  return (
    <nav class="hidden shrink-0 items-center gap-6 md:flex" aria-label="Primary">
      <NavLink href="/" end>
        {props.dashboardLabel}
      </NavLink>
      <NavLink href="/agents" end>
        {props.agentsLabel}
      </NavLink>
    </nav>
  )
}

function HeaderSearch(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  return (
    <Show when={props.searchSlot}>
      {(searchSlot) => (
        <div class="mx-auto w-full min-w-[220px] max-w-[var(--dashboard-search-width)] [&>[data-search-trigger='true']]:h-[var(--dashboard-search-height)] [&>[data-search-trigger='true']]:min-h-[var(--dashboard-search-height)] [&_[data-slot='input']]:h-[var(--dashboard-search-height)] [&_[data-slot='input']]:min-h-[var(--dashboard-search-height)]">
          {searchSlot()}
        </div>
      )}
    </Show>
  )
}

function CreateProcessButton(props: {
  readonly label: string
  readonly onCreateProcess?: () => void
}): JSX.Element {
  return (
    <Show when={props.onCreateProcess}>
      <button
        type="button"
        onClick={() => props.onCreateProcess?.()}
        aria-label={props.label}
        class="inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] flex-none items-center justify-center gap-2 rounded-[var(--dashboard-control-radius)] bg-primary px-3.5 text-sm-ui font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span class="hidden sm:inline">{props.label}</span>
      </button>
    </Show>
  )
}

function ThemeToggleButton(): JSX.Element {
  const { t, keys } = useTranslation()
  const [theme, setTheme] = createSignal<UiTheme>(getTheme())

  const isDark = () => theme() === 'dark'
  const actionLabel = () =>
    isDark() ? t(keys.header.theme.switchToLight) : t(keys.header.theme.switchToDark)

  const handleToggle = () => {
    setTheme(toggleTheme())
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      class={OUTLINE_BUTTON_CLASS}
      aria-label={actionLabel()}
      title={actionLabel()}
    >
      <Show when={isDark()} fallback={<Moon class="h-4 w-4 shrink-0" aria-hidden="true" />}>
        <Sun class="h-4 w-4 shrink-0" aria-hidden="true" />
      </Show>
    </button>
  )
}

function HeaderActions(props: {
  readonly syncSlot?: JSX.Element
  readonly actionsSlot?: JSX.Element
  readonly createProcessLabel: string
  readonly onCreateProcess?: () => void
}): JSX.Element {
  return (
    <div class="navbar-right flex min-w-0 items-center justify-end gap-2 whitespace-nowrap">
      <Show when={props.syncSlot}>
        {(syncSlot) => <div class="flex items-center">{syncSlot()}</div>}
      </Show>
      <CreateProcessButton
        label={props.createProcessLabel}
        {...(props.onCreateProcess ? { onCreateProcess: props.onCreateProcess } : {})}
      />
      <NavbarAlertsButton />

      <div class="flex items-center">
        <LanguageSwitch />
      </div>
      <ThemeToggleButton />
      <Show when={props.actionsSlot}>
        {(actionsSlot) => <div class="flex items-center gap-2">{actionsSlot()}</div>}
      </Show>
    </div>
  )
}

export function AppHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="border-b border-border bg-surface">
      <div class="mx-auto grid min-h-[var(--navbar-height)] w-full max-w-[var(--dashboard-container-max-width)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-[var(--dashboard-container-px)] py-2 max-[1279px]:gap-x-3.5 max-[1023px]:grid-cols-[minmax(0,1fr)_auto]">
        <div class="navbar-left flex min-w-0 items-center gap-3 max-[1279px]:gap-4 lg:gap-6">
          <HeaderBrand />
          <HeaderNavigation
            dashboardLabel={t(keys.header.nav.dashboard)}
            agentsLabel={t(keys.header.nav.agents)}
          />
        </div>

        <div class="navbar-center min-w-0 max-[1023px]:col-span-2 max-[1023px]:row-start-2">
          <HeaderSearch searchSlot={props.searchSlot} />
        </div>

        <div class="max-[1023px]:justify-self-end">
          <HeaderActions
            createProcessLabel={t(keys.header.createProcess)}
            {...(props.syncSlot ? { syncSlot: props.syncSlot } : {})}
            {...(props.actionsSlot ? { actionsSlot: props.actionsSlot } : {})}
            {...(props.onCreateProcess ? { onCreateProcess: props.onCreateProcess } : {})}
          />
        </div>
      </div>
    </header>
  )
}
