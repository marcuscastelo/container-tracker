import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { LanguageSwitch } from '~/shared/ui/LanguageSwitch'

type Props = {
  readonly onCreateProcess?: () => void
  readonly alertCount?: number
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
      class="relative px-3 py-2.5 text-md-ui font-medium text-slate-400 transition-colors hover:text-white"
      activeClass="!text-white after:content-[''] after:absolute after:bottom-0 after:left-1 after:right-1 after:h-[2px] after:rounded-full after:bg-sky-300"
    >
      {props.children}
    </A>
  )
}

function AlertCountBadge(props: { count: number; label: string }): JSX.Element {
  return (
    <span class="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-xs-ui font-bold tabular-nums text-white">
      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      {props.label}
    </span>
  )
}

export function AppHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="border-b border-[#1e2145] bg-[#2c2f59]">
      <div class="mx-auto flex h-11 max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Brand */}
        <div class="flex items-center gap-6">
          <A href="/" class="flex items-center gap-2 text-white">
            <img
              src={BRANDING.logoPrimary}
              alt=""
              aria-hidden="true"
              class="h-7 w-auto object-contain"
            />
            <span class="text-sm-ui font-bold tracking-tight">{t(keys.header.brand)}</span>
          </A>

          {/* Navigation — border-bottom active indicator */}
          <nav class="hidden items-center gap-0.5 md:flex">
            <NavLink href="/" end>
              {t(keys.header.nav.dashboard)}
            </NavLink>
            <NavLink href="/shipments">{t(keys.header.nav.shipments)}</NavLink>
            <NavLink href="/containers">{t(keys.header.nav.containers)}</NavLink>
            <NavLink href="/agents">{t(keys.header.nav.agents)}</NavLink>
          </nav>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2">
          <Show when={props.alertCount != null && props.alertCount > 0}>
            <AlertCountBadge
              count={props.alertCount ?? 0}
              label={t(keys.header.alertsBadge, { count: props.alertCount ?? 0 })}
            />
          </Show>
          <LanguageSwitch />
          <button
            type="button"
            onClick={() => props.onCreateProcess?.()}
            aria-label={t(keys.header.createProcess)}
            class="inline-flex items-center gap-1.5 rounded bg-sky-500 px-2.5 py-1 text-sm-ui font-semibold text-white transition-colors hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1 focus:ring-offset-[#2c2f59]"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="hidden sm:inline">{t(keys.header.createProcess)}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
