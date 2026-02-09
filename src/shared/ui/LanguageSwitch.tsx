import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

// Small mapping of language code to a representative country code for flags.
// This is a best-effort fallback when the locale doesn't include a region subtag.
const languageFallbackCountry: Record<string, string> = {
  en: 'GB',
  pt: 'PT',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  nl: 'NL',
  ja: 'JP',
  zh: 'CN',
  ru: 'RU',
}

function countryCodeToFlagEmoji(code: string): string {
  // Expect code like 'PT' or 'US'
  if (!code || code.length !== 2) return ''
  const A = 0x1f1e6
  const a = 'A'.codePointAt(0) ?? 65
  const chars = code.toUpperCase().split('')
  return String.fromCodePoint(...chars.map((c) => A + (c.codePointAt(0) ?? a) - a))
}

function localeToFlag(locale: string): string {
  // If locale includes region like en-US or pt_BR, extract region
  const parts = locale.replace('_', '-').split('-')
  if (parts.length >= 2) {
    return countryCodeToFlagEmoji(parts[1].slice(0, 2))
  }
  // fallback to language->country mapping
  const fallback = languageFallbackCountry[parts[0]]
  if (fallback) return countryCodeToFlagEmoji(fallback)
  // last resort: show uppercased locale code letters (not an emoji)
  return parts[0].toUpperCase()
}

export function LanguageSwitch(): JSX.Element {
  const { locale, setLocale, availableLocales } = useTranslation()
  const [open, setOpen] = createSignal(false)

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        class="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open()}
      >
        <span class="text-lg" aria-hidden>
          {localeToFlag(locale())}
        </span>
        <span class="sr-only">Language</span>
      </button>

      <Show when={open()}>
        <ul
          role="listbox"
          class="absolute right-0 mt-2 w-36 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
          onMouseLeave={() => setOpen(false)}
        >
          <For each={availableLocales}>
            {(lng) => (
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setLocale(lng)
                    setOpen(false)
                  }}
                >
                  <span class="text-lg">{localeToFlag(lng)}</span>
                  <span class="truncate">{lng}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}

// prefer named export only
