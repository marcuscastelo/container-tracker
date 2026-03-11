import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { LanguageSwitch } from '~/shared/ui/LanguageSwitch'

type Props = {
  readonly onCreateProcess?: () => void
  readonly alertCount?: number
  readonly searchSlot?: JSX.Element
  readonly syncSlot?: JSX.Element
}

function NavLink(props: {
  readonly href: string
  readonly children: JSX.Element
  readonly end?: boolean
}): JSX.Element {
  return (
    <A
      href={props.href}
      end={props.end}
      class="dashboard-navbar-nav-link"
      activeClass="dashboard-navbar-nav-link-active"
    >
      {props.children}
    </A>
  )
}

function AlertCountBadge(props: { label: string }): JSX.Element {
  return (
    <span class="dashboard-navbar-alert-badge">
      <svg
        class="dashboard-navbar-alert-icon"
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
  return (
    <A href="/" class="dashboard-navbar-brand" aria-label={BRANDING.displayTitle}>
      <img src={BRANDING.logoPrimary} alt={BRANDING.companyName} class="dashboard-navbar-logo" />
      <span class="dashboard-navbar-brand-copy">
        <span class="dashboard-navbar-brand-title">{BRANDING.productName}</span>
        <span class="dashboard-navbar-brand-subtitle">{BRANDING.companyName}</span>
      </span>
    </A>
  )
}

function HeaderNavigation(props: {
  readonly dashboardLabel: string
  readonly agentsLabel: string
}): JSX.Element {
  return (
    <nav class="dashboard-navbar-nav" aria-label="Primary">
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
      {(searchSlot) => <div class="dashboard-navbar-search">{searchSlot()}</div>}
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
        class="dashboard-btn-primary"
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

function HeaderActions(props: {
  readonly syncSlot?: JSX.Element
  readonly createProcessLabel: string
  readonly onCreateProcess?: () => void
  readonly alertCount?: number
  readonly alertLabel: string
}): JSX.Element {
  return (
    <div class="dashboard-navbar-right">
      <Show when={props.syncSlot}>
        {(syncSlot) => <div class="dashboard-navbar-control">{syncSlot()}</div>}
      </Show>

      <CreateProcessButton
        label={props.createProcessLabel}
        onCreateProcess={props.onCreateProcess}
      />

      <Show when={props.alertCount != null}>
        <AlertCountBadge label={props.alertLabel} />
      </Show>

      <div class="dashboard-navbar-control">
        <LanguageSwitch />
      </div>
    </div>
  )
}

export function AppHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="dashboard-navbar">
      <div class="dashboard-navbar-inner">
        <div class="dashboard-navbar-left">
          <HeaderBrand />
          <div class="dashboard-navbar-left-nav">
            <HeaderNavigation
              dashboardLabel={t(keys.header.nav.dashboard)}
              agentsLabel={t(keys.header.nav.agents)}
            />
          </div>
        </div>

        <div class="dashboard-navbar-center">
          <HeaderSearch searchSlot={props.searchSlot} />
        </div>

        <HeaderActions
          syncSlot={props.syncSlot}
          createProcessLabel={t(keys.header.createProcess)}
          onCreateProcess={props.onCreateProcess}
          alertCount={props.alertCount}
          alertLabel={t(keys.header.alertsBadge, { count: props.alertCount ?? 0 })}
        />
      </div>
    </header>
  )
}
