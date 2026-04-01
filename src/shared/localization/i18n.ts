import type { BaseTemplateArgs } from '@solid-primitives/i18n'
import { flatten, resolveTemplate, translator } from '@solid-primitives/i18n'
import ptBR from '~/locales/pt-BR.json'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import type {
  TranslationFlatDictionary,
  TranslationKeys,
  TranslationLeafKey,
} from '~/shared/localization/translationTypes'

export type TranslationParams = Readonly<Record<string, unknown>>

export type TranslationApi = {
  readonly t: (key: string, params?: TranslationParams) => string
  readonly keys: TranslationKeys
  readonly locale: () => string
}

type TranslationApiOptions = {
  readonly devMode: boolean
}

const flatDictionary: TranslationFlatDictionary = flatten(ptBR)
const translate = translator(() => flatDictionary, resolveTemplate)
const warnedMissingKeys = new Set<string>()

function isTemplateValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function normalizeTemplateArgs(params?: TranslationParams): BaseTemplateArgs | undefined {
  if (params === undefined) return undefined

  const normalized: BaseTemplateArgs = {}

  for (const [key, value] of Object.entries(params)) {
    if (isTemplateValue(value)) {
      normalized[key] = value
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function hasTranslationKey(key: string): key is keyof TranslationFlatDictionary {
  return Object.hasOwn(flatDictionary, key)
}

function isTranslationLeafKey(key: string): key is TranslationLeafKey {
  if (!hasTranslationKey(key)) {
    return false
  }

  return typeof flatDictionary[key] === 'string'
}

function createKeyProxy<T extends object>(path = ''): T {
  return new Proxy<T>(Object.create(null), {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined
      }

      const nextPath = path ? `${path}.${property}` : property

      if (isTranslationLeafKey(nextPath)) {
        return nextPath
      }

      return createKeyProxy(nextPath)
    },
  })
}

const keys = createKeyProxy<TranslationKeys>()
const locale = () => DEFAULT_LOCALE

function warnMissingKey(key: string): void {
  if (warnedMissingKeys.has(key)) return

  warnedMissingKeys.add(key)
  console.warn(`[i18n] Missing translation key: '${key}'.`)
}

function resolveMissingKey(key: string, devMode: boolean): string {
  if (devMode) {
    warnMissingKey(key)
    return `[missing] ${key}`
  }

  return key
}

export function createTranslationApi(options: TranslationApiOptions): TranslationApi {
  return {
    t: (key, params) => {
      if (!isTranslationLeafKey(key)) {
        return resolveMissingKey(key, options.devMode)
      }

      const templateArgs = normalizeTemplateArgs(params)
      const translated = templateArgs === undefined ? translate(key) : translate(key, templateArgs)

      return typeof translated === 'string' ? translated : resolveMissingKey(key, options.devMode)
    },
    keys,
    locale,
  }
}

const translationApi = createTranslationApi({
  devMode: import.meta.env.DEV,
})

export function useTranslation(): TranslationApi {
  return translationApi
}
