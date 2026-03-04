// This file derives TypeScript types from the reference locale JSON (pt-BR)
// so we can get compile-time checked key strings like 'shipmentView.header'.
// No codegen required: we import the JSON and infer the type shape.

import ptBR from '~/locales/pt-BR.json'

// Use the raw JSON shape as the translation schema so deeply nested keys are supported
// This avoids hard-coded depth limits and keeps typing in sync with the reference locale.
export type TranslationSchema = typeof ptBR

// export the raw reference in case consumers want to inspect it
export const referenceLocale = ptBR as TranslationSchema

// Nested object shape mirroring the translation JSON where leaves are the dotted key strings.
type KeysObject<T, P extends string = ''> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? P extends ''
      ? K
      : `${P}.${K}`
    : KeysObject<T[K], P extends '' ? K : `${P}.${K}`>
}

export type TranslationKeys = KeysObject<TranslationSchema>
