import type { Resource } from 'i18next'
import i18next from 'i18next'
import { createSignal } from 'solid-js'
import z from 'zod'
import { safeParseOrDefault } from '~/modules/container-events/infrastructure/persistence/containerEventMappers'

// Dynamically load all locale JSON files from ./locales folder.
// This makes adding a new locale seamless: drop a new JSON file and it will be picked up.
// Vite's import.meta.glob is used with eager import to obtain the parsed JSON at build time.
const modules = import.meta.glob('./locales/*.json', { eager: true })

const resources: Resource = {}
const availableLocales: string[] = []

for (const path of Object.keys(modules)) {
  // path looks like './locales/en.json' -> extract 'en'
  const match = path.match(/\.\/locales\/([^.]+)\.json$/)
  if (!match) continue
  const key = match[1]
  // modules[path] may be `{ default: {...} }` when using eager import, or the object itself.
  const mod: unknown = modules[path]
  let translation: Record<string, unknown> | undefined = undefined
  // Use zod to safely parse module shape (some bundlers return { default: {...} })
  const modRec = safeParseOrDefault(mod, z.record(z.string(), z.unknown()).parse, null)
  if (modRec) {
    if (
      'default' in modRec &&
      typeof (modRec as any).default === 'object' &&
      (modRec as any).default !== null
    ) {
      const def = safeParseOrDefault(
        (modRec as any).default,
        z.record(z.string(), z.unknown()).parse,
        null,
      )
      if (def) translation = def
    } else {
      translation = modRec
    }
  }
  if (translation) resources[key] = { translation }
  availableLocales.push(key)
}

// Initialize i18next with discovered resources
import type { InitOptions } from 'i18next'

// If the user previously selected a language, prefer that (persisted in localStorage)
const storedLang = typeof window !== 'undefined' ? (localStorage.getItem('locale') ?? null) : null

const initialLng =
  storedLang && availableLocales.includes(storedLang)
    ? storedLang
    : availableLocales.includes(i18next.language)
      ? i18next.language
      : (availableLocales[0] ?? 'pt-BR')

const initOptions: InitOptions = {
  resources,
  lng: initialLng,
  fallbackLng: availableLocales.includes('pt-BR') ? 'pt-BR' : (availableLocales[0] ?? 'pt-BR'),
  interpolation: { escapeValue: false },
}

i18next.init(initOptions)

const [locale, setLocale] = createSignal(initialLng)
i18next.on('languageChanged', (lng) => setLocale(lng))

export function useTranslation() {
  return {
    // make t reactive by reading the `locale` signal inside; this ensures Solid re-renders
    // components that call `t(...)` whenever the language changes
    t: (...args: Parameters<typeof i18next.t>) => {
      locale()
      return i18next.t(...args)
    },
    locale,
    setLocale: async (lng: string) => {
      // persist choice in localStorage (client only) and change i18next language
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('locale', lng)
        } catch {
          // ignore storage errors (quota/private mode)
        }
      }
      return i18next.changeLanguage(lng)
    },
    availableLocales,
  }
}

export const i18n = i18next
