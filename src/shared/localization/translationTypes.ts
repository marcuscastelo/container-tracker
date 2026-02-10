// This file derives TypeScript types from the reference locale JSON (pt-BR)
// so we can get compile-time checked key strings like 'shipmentView.header'.
// No codegen required: we import the JSON and infer the type shape.

import ptBR from '~/locales/pt-BR.json'

// Helper types to produce dotted key paths for nested objects whose leaves are strings.
type IsRecord<T> = T extends string ? false : T extends Record<string, any> ? true : false

type Join<K extends string, P extends string> = P extends '' ? K : `${K}.${P}`

// biome-ignore lint/correctness/noUnusedVariables: KeyPaths is recursively used in its own definition
type KeyPaths<T> = T extends string
  ? ''
  : {
      [K in Extract<keyof T, string>]: IsRecord<T[K]> extends true ? Join<K, KeyPaths<T[K]>> : K
    }[Extract<keyof T, string>]

export type TranslationSchema = {
  [K in keyof typeof ptBR]: (typeof ptBR)[K] extends string
    ? (typeof ptBR)[K]
    : {
        [K2 in keyof (typeof ptBR)[K]]: (typeof ptBR)[K][K2] extends string
          ? (typeof ptBR)[K][K2]
          : {
              [K3 in keyof (typeof ptBR)[K][K2]]: (typeof ptBR)[K][K2][K3] extends string
                ? (typeof ptBR)[K][K2][K3]
                : {
                    [K4 in keyof (typeof ptBR)[K][K2][K3]]: (typeof ptBR)[K][K2][K3][K4] extends string
                      ? (typeof ptBR)[K][K2][K3][K4]
                      : unknown
                  }
            }
      }
}

// export the raw reference in case consumers want to inspect it
// biome-ignore lint: Assertion is required and low risk since it's only used for typing, not runtime logic
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
