import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
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
      class="relative px-3 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-white"
      activeClass="!text-white after:content-[''] after:absolute after:bottom-0 after:left-1 after:right-1 after:h-[2px] after:rounded-full after:bg-blue-400"
    >
      {props.children}
    </A>
  )
}

export function AppHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="border-b border-slate-800 bg-slate-900">
      <div class="mx-auto flex h-11 max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Brand */}
        <div class="flex items-center gap-6">
          <A href="/" class="flex items-center gap-2 text-white">
            <svg
              class="h-5 w-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <span class="text-sm font-bold tracking-tight">{t(keys.header.brand)}</span>
          </A>

          {/* Navigation — border-bottom active indicator */}
          <nav class="hidden items-center gap-0.5 md:flex">
            <NavLink href="/" end>
              {t(keys.header.nav.dashboard)}
            </NavLink>
            <NavLink href="/shipments">{t(keys.header.nav.shipments)}</NavLink>
            <NavLink href="/containers">{t(keys.header.nav.containers)}</NavLink>
          </nav>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2">
          <Show when={props.alertCount != null && props.alertCount > 0}>
            <span class="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
              <svg
                class="h-3 w-3"
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
              {t(keys.header.alertsBadge, { count: props.alertCount ?? 0 })}
            </span>
          </Show>
          <LanguageSwitch />
          <button
            type="button"
            onClick={() => props.onCreateProcess?.()}
            aria-label={t(keys.header.createProcess)}
            class="inline-flex items-center gap-1.5 rounded bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-slate-900"
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
