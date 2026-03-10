import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'

export function resolveInitialLanguage(
  availableLocales: readonly string[],
  storedLang: string | null,
  currentLanguage: string | undefined,
): string {
  if (storedLang && availableLocales.includes(storedLang)) return storedLang
  if (availableLocales.includes(DEFAULT_LOCALE)) return DEFAULT_LOCALE
  if (currentLanguage && availableLocales.includes(currentLanguage)) return currentLanguage
  return availableLocales[0] ?? DEFAULT_LOCALE
}

export function resolveFallbackLanguage(availableLocales: readonly string[]): string {
  return availableLocales.includes(DEFAULT_LOCALE)
    ? DEFAULT_LOCALE
    : (availableLocales[0] ?? DEFAULT_LOCALE)
}
