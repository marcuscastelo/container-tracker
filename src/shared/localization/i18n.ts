import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { createRoot, createSignal, onMount } from 'solid-js'
import { loadProjectResources } from '~/shared/localization/resources'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import { referenceLocale } from '~/shared/localization/translationTypes'

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

  // biome-ignore lint: keys object is built from reference locale and provides type safety, so no need for exhaustive checks
  const actualKeys = buildKeys(referenceLocale) as TranslationKeys

  function createProxy(target: any, path = ''): any {
    return new Proxy(target, {
      get(_target, prop) {
        if (prop in target) {
          // biome-ignore lint: We know this is safe because we only create proxies for objects derived from the reference locale, which has a consistent shape.
          const value = target[prop as keyof typeof target]
          if (typeof value === 'object' && value !== null) {
            return createProxy(value, path ? `${path}.${String(prop)}` : String(prop))
          }
          return value
        }
        // If accessed key doesn't exist in reference, return the prop as string to avoid breaking the app, but log a warning.
        if (typeof prop === 'string') {
          const fullKey = path ? `${path}.${prop}` : prop
          console.warn(
            `[i18n] Accessing missing translation key: '${fullKey}'. Make sure it's present in the reference locale.`,
          )
          return fullKey
        }
        throw new Error(`Invalid translation key access: ${String(prop)}`)
      },
    })
  }

  // Create proxy that generates strings based on path. So keys.foo.bar === 'foo.bar', but with type safety and IDE support.
  // biome-ignore lint: Proxy is necessary here to achieve the desired API and type safety, and the implementation is straightforward and low-risk.
  const keys = createProxy(actualKeys) as TranslationKeys

  // Build a set of valid reference keys for runtime validation/warnings
  function flattenKeys(obj: any, prefix = ''): string[] {
    const out: string[] = []
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out.push(...flattenKeys(v, p))
      } else {
        out.push(p)
      }
    }
    return out
  }

  const referenceKeySet = new Set(flattenKeys(referenceLocale))
  const warnedKeys = new Set<string>()
  const warnedFallbacks = new Set<string>()

  return {
    t: (...args: Parameters<typeof i18next.t>) => {
      locale() // ensure we track locale changes in this scope
      const key = args[0]
      // Only warn in browser and when key is a string
      if (typeof window !== 'undefined' && typeof key === 'string') {
        // If the key is not present in the reference set, warn once
        if (!referenceKeySet.has(key) && !warnedKeys.has(key)) {
          warnedKeys.add(key)
          try {
            // include a small stack trace to help locate the callsite
            const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') || ''
            // eslint-disable-next-line no-console
            console.warn(
              `[i18n] Missing translation key: '${key}'. Make sure it's present in the reference locale.\n${stack}`,
            )
          } catch {
            // ignore
            // eslint-disable-next-line no-console
            console.warn(
              `[i18n] Missing translation key: '${key}'. Make sure it's present in the reference locale.`,
            )
          }
        }

        // Additionally, warn if the current locale does not have this key and i18next fell back
        try {
          const current = locale()
          const hasInCurrent = Boolean(i18next.getResource(current, 'translation', key))
          if (!hasInCurrent) {
            console.warn(
              `[i18n] Key '${key}' is missing in current locale '${current}'. Checking for fallbacks...`,
            )
            const resolved = i18next.t(...args)
            // If resolved differs from raw key (i.e., some translation was returned), assume fallback
            if (typeof resolved === 'string' && resolved !== key) {
              const warnId = `${current}::${key}`
              if (!warnedFallbacks.has(warnId)) {
                warnedFallbacks.add(warnId)
                // find which locale provided the translation (best-effort)
                let provider: string | null = null
                for (const lng of availableLocales) {
                  if (lng === current) continue
                  if (i18next.getResource(lng, 'translation', key)) {
                    provider = lng
                    break
                  }
                }
                // eslint-disable-next-line no-console
                console.warn(
                  `[i18n] Using fallback translation for key '${key}' — missing in '${current}'${provider ? `, found in '${provider}'` : ''}`,
                )
              }
            }
          }
        } catch {
          /* ignore detection errors */
        }
      }
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
