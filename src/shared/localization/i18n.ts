// Initialize i18next with discovered resources
import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { createRoot, createSignal, onMount } from 'solid-js'
import { loadProjectResources } from '~/shared/localization/resources'

// If the user previously selected a language, prefer that (persisted in localStorage)
const storedLang = typeof window !== 'undefined' ? (localStorage.getItem('locale') ?? null) : null

const localeRoot = createRoot(() => {
  const { resources, availableLocales } = loadProjectResources()
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
  const [locale, setLocale] = createSignal(initialLng)

  onMount(() => {
    console.debug('Initializing i18next with options', initOptions)
    console.debug('Available locales:', availableLocales)
    i18next.init(initOptions)
    i18next.on('languageChanged', (lng) => setLocale(lng))
  })

  return { locale, availableLocales }
})

export function useTranslation() {
  const { locale, availableLocales } = localeRoot
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
          console.warn('Could not persist locale selection') // ignore storage errors (quota/private mode)
        }
      }
      return i18next.changeLanguage(lng)
    },
    availableLocales,
  }
}

export const i18n = i18next
