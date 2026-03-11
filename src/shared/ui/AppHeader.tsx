import { A } from '@solidjs/router'
import { Moon, Sun } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { getTheme, toggleTheme, type UiTheme } from '~/lib/theme'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { LanguageSwitch } from '~/shared/ui/LanguageSwitch'

type Props = {
  readonly onCreateProcess?: () => void
  readonly alertCount?: number
  readonly searchSlot?: JSX.Element
  readonly syncSlot?: JSX.Element
}

const OUTLINE_BUTTON_CLASS =
  'inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] items-center justify-center gap-2 rounded-[var(--dashboard-control-radius)] border border-border bg-surface px-3 text-sm-ui font-medium text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

function NavLink(props: {
  readonly href: string
  readonly children: JSX.Element
  readonly end?: boolean
}): JSX.Element {
  return (
    <A
      href={props.href}
      end={props.end}
      class="relative px-1 py-2 text-sm-ui font-medium text-text-muted transition-colors hover:text-primary"
      activeClass="text-primary after:absolute after:-bottom-4 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-primary"
    >
      {props.children}
    </A>
  )
}

function AlertCountBadge(props: { label: string }): JSX.Element {
  return (
    <span class="inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] items-center gap-1.5 whitespace-nowrap rounded-full bg-red-100 px-3 text-xs-ui font-semibold text-red-700">
      <svg
        class="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>{props.label}</span>
    </span>
  )
}

function HeaderBrand(): JSX.Element {
  const logoSrc = () =>
    getTheme() === 'dark' ? BRANDING.logoPrimaryDark : BRANDING.logoPrimaryLight
  return (
    <A
      href="/"
      class="flex min-w-0 items-center gap-3 text-primary"
      aria-label={BRANDING.displayTitle}
    >
      <img
        src={logoSrc()}
        alt={BRANDING.companyName}
        class="block h-10 w-auto shrink-0 object-contain"
      />
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-lg-ui font-semibold leading-tight tracking-[-0.01em]">
          {BRANDING.productName}
        </span>
        <span class="truncate text-xs-ui font-medium text-text-muted max-[560px]:hidden">
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
    <nav class="hidden items-center gap-6 md:flex" aria-label="Primary">
      <NavLink href="/" end>
        {props.dashboardLabel}
      </NavLink>
      <NavLink href="/agents">{props.agentsLabel}</NavLink>
    </nav>
  )
}

function HeaderSearch(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  return (
    <Show when={props.searchSlot}>
      {(searchSlot) => (
        <div class="w-full min-w-0 max-w-full lg:max-w-[var(--dashboard-search-width)] lg:min-w-[var(--dashboard-search-min-width)] [&_[data-slot='input']]:h-[var(--dashboard-search-height)] [&_[data-slot='input']]:min-h-[var(--dashboard-search-height)] [&_button]:h-[var(--dashboard-search-height)] [&_button]:min-h-[var(--dashboard-search-height)]">
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
  const currentLabel = () => (isDark() ? t(keys.header.theme.dark) : t(keys.header.theme.light))
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
      <span class="hidden sm:inline">{currentLabel()}</span>
    </button>
  )
}

function HeaderActions(props: {
  readonly syncSlot?: JSX.Element
  readonly createProcessLabel: string
  readonly onCreateProcess?: () => void
  readonly alertCount?: number
  readonly alertLabel: string
}): JSX.Element {
  return (
    <div class="flex min-w-0 flex-1 items-center justify-end gap-2 lg:flex-none">
      <Show when={props.syncSlot}>
        {(syncSlot) => <div class="flex items-center">{syncSlot()}</div>}
      </Show>

      <CreateProcessButton
        label={props.createProcessLabel}
        onCreateProcess={props.onCreateProcess}
      />

      <Show when={props.alertCount != null && props.alertCount > 0}>
        <AlertCountBadge label={props.alertLabel} />
      </Show>

      <div class="flex items-center">
        <LanguageSwitch />
      </div>
      <ThemeToggleButton />
    </div>
  )
}

export function AppHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="border-b border-border bg-surface">
      <div class="mx-auto flex min-h-[var(--navbar-height)] w-full max-w-[var(--dashboard-container-max-width)] flex-wrap items-center gap-x-5 gap-y-2 px-[var(--dashboard-container-px)] py-2 max-[1180px]:gap-x-3.5">
        <div class="flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:gap-6">
          <HeaderBrand />
          <HeaderNavigation
            dashboardLabel={t(keys.header.nav.dashboard)}
            agentsLabel={t(keys.header.nav.agents)}
          />
        </div>

        <div class="order-3 w-full min-w-0 lg:order-2 lg:flex lg:flex-1 lg:items-center lg:justify-center">
          <HeaderSearch searchSlot={props.searchSlot} />
        </div>

        <div class="order-2 lg:order-3">
          <HeaderActions
            syncSlot={props.syncSlot}
            createProcessLabel={t(keys.header.createProcess)}
            onCreateProcess={props.onCreateProcess}
            alertCount={props.alertCount}
            alertLabel={t(keys.header.alertsBadge, { count: props.alertCount ?? 0 })}
          />
        </div>
      </div>
    </header>
  )
}
