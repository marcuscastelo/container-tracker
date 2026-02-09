import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { createRoot, createSignal, onMount } from 'solid-js'
import { loadProjectResources } from '~/shared/localization/resources'
import type { TranslationKeys, TypedTFunction } from './translationTypes'
import { referenceLocale } from './translationTypes'

// --- Constants ---

const DEFAULT_LOCALE = 'pt-BR'

// --- Utilities ---

function getStoredLang(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('locale') ?? null
}

function getInitialLanguage(
  availableLocales: readonly string[],
  storedLang: string | null,
): string {
  if (storedLang && availableLocales.includes(storedLang)) return storedLang
  if (availableLocales.includes(i18next.language)) return i18next.language
  return availableLocales[0] ?? DEFAULT_LOCALE
}

function getFallbackLanguage(availableLocales: readonly string[]): string {
  return availableLocales.includes(DEFAULT_LOCALE)
    ? DEFAULT_LOCALE
    : (availableLocales[0] ?? DEFAULT_LOCALE)
}

function persistLocale(lng: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('locale', lng)
    } catch {
      console.warn('Could not persist locale selection')
    }
  }
}

// --- i18n Root ---

const localeRoot = createRoot(() => {
  const { resources, availableLocales } = loadProjectResources()
  const storedLang = getStoredLang()
  const initialLng = getInitialLanguage(availableLocales, storedLang)
  const fallbackLng = getFallbackLanguage(availableLocales)

  const initOptions: InitOptions = {
    resources,
    lng: initialLng,
    fallbackLng,
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

// --- API ---

export function useTranslation() {
  const { locale, availableLocales } = localeRoot
  // build a keys object from the reference locale (memoized at module/runtime)
  function buildKeys(obj: any, prefix = ''): any {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = buildKeys(v, p)
      } else {
        out[k] = p
      }
    }
    return out
  }

  const keys = buildKeys(referenceLocale) as TranslationKeys

  return {
    t: (...args: Parameters<typeof i18next.t>) => {
      locale() // ensure we track locale changes in this scope
      return i18next.t(...args)
    },
    keys,
    locale,
    setLocale: async (lng: string) => {
      persistLocale(lng)
      return i18next.changeLanguage(lng)
    },
    availableLocales,
  }
}

export const i18n = i18next
