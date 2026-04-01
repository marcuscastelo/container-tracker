import type { Flatten } from '@solid-primitives/i18n'
import type ptBR from '~/locales/pt-BR.json'

export type TranslationSchema = typeof ptBR
export type TranslationFlatDictionary = Flatten<TranslationSchema>

// Nested object shape mirroring the translation JSON where leaves are the dotted key strings.
type KeysObject<T, P extends string = ''> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? P extends ''
      ? K
      : `${P}.${K}`
    : KeysObject<T[K], P extends '' ? K : `${P}.${K}`>
}

export type TranslationKeys = KeysObject<TranslationSchema>

export type TranslationLeafKey = {
  [K in keyof TranslationFlatDictionary]: TranslationFlatDictionary[K] extends string ? K : never
}[keyof TranslationFlatDictionary]
