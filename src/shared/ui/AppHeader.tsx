import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { LanguageSwitch } from '.'

type Props = {
  readonly onCreateProcess?: () => void
}

export function AppHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="border-b border-slate-200 bg-slate-900">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div class="flex items-center gap-8">
          <A href="/" class="flex items-center gap-2 text-white">
            <svg
              class="h-6 w-6"
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
            <span class="text-lg font-semibold">{t(keys.header.brand)}</span>
          </A>

          {/* Navigation */}
          <nav class="hidden items-center gap-1 md:flex">
            <A
              href="/"
              class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              activeClass="bg-slate-800 text-white"
            >
              {t(keys.header.nav.dashboard)}
            </A>
            <A
              href="/shipments"
              class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              activeClass="bg-slate-800 text-white"
            >
              {t(keys.header.nav.shipments)}
            </A>
            <A
              href="/containers"
              class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              activeClass="bg-slate-800 text-white"
            >
              {t(keys.header.nav.containers)}
            </A>
          </nav>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-4">
          <LanguageSwitch />
          <button
            type="button"
            onClick={props.onCreateProcess}
            class="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
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
            {t(keys.header.createProcess)}
          </button>
        </div>
      </div>
    </header>
  )
}
