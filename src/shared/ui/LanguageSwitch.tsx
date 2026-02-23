import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
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

type LanguageOptionProps = {
  readonly language: string
  readonly onSelect: (language: string) => void
}

function LanguageOption(props: LanguageOptionProps): JSX.Element {
  return (
    <li>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        onClick={() => props.onSelect(props.language)}
      >
        <span class="text-lg">{localeToFlag(props.language)}</span>
        <span class="truncate">{props.language}</span>
      </button>
    </li>
  )
}

export function LanguageSwitch(): JSX.Element {
  const { t, keys, locale, setLocale, availableLocales } = useTranslation()
  const [open, setOpen] = createSignal(false)
  const handleSelect = (lng: string) => {
    setLocale(lng).catch(() => {
      /* ignore */
    })
    setOpen(false)
  }

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
        <span class="sr-only">{t(keys.languageSwitch.label)}</span>
      </button>

      {open() ? (
        <ul
          class="absolute right-0 mt-2 w-36 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
          onMouseLeave={() => setOpen(false)}
        >
          <For each={availableLocales}>
            {(lng) => <LanguageOption language={lng} onSelect={handleSelect} />}
          </For>
        </ul>
      ) : null}
    </div>
  )
}

// prefer named export only
