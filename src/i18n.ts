import i18next from 'i18next'
import { createSignal } from 'solid-js'
import en from './locales/en.json'
import pt from './locales/pt.json'

// Initialize i18next with local resources
i18next.init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: 'pt',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

const [locale, setLocale] = createSignal(i18next.language || 'pt')
i18next.on('languageChanged', (lng) => setLocale(lng))

export function useTranslation() {
  return {
    t: (...args: Parameters<typeof i18next.t>) => i18next.t(...args),
    locale,
    setLocale: (lng: string) => i18next.changeLanguage(lng),
  }
}

export const i18n = i18next
