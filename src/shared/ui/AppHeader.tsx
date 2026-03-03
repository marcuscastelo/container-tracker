import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { LanguageSwitch } from '~/shared/ui/LanguageSwitch'

type Props = {
  readonly onCreateProcess?: () => void
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
      activeClass="!text-white after:absolute after:bottom-0 after:left-1 after:right-1 after:h-[2px] after:rounded-full after:bg-blue-400"
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
          <LanguageSwitch />
          <button
            type="button"
            onClick={() => props.onCreateProcess?.()}
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
