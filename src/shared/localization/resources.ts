import type { Resource } from 'i18next'
import z from 'zod'
// Dynamically load all locale JSON files from ./locales folder.
// This makes adding a new locale seamless: drop a new JSON file and it will be picked up.
// Vite's import.meta.glob is used with eager import to obtain the parsed JSON at build time.
import * as reference from '~/locales/pt-BR.json' // ensure at least one locale is included in the bundle
import { safeParseOrDefault } from '~/modules/container-events/infrastructure/persistence/containerEventMappers'
import { hasDefaultProp, isRecord } from '~/shared/utils/typeGuards'

const modules = import.meta.glob('~/locales/*.json', { eager: true })

function schemaFromKeys<T extends Record<string, unknown>>(obj: T) {
  return z.object(
    // biome-ignore lint: Type assertion is necessary to convert from Record<string, unknown> to Record<keyof T, ZodTypeAny>
    Object.fromEntries(Object.keys(obj).map((k) => [k, z.unknown()])) as unknown as Record<
      keyof T,
      z.ZodTypeAny
    >,
  )
}

export function loadProjectResources() {
  console.debug('Loading localization resources from modules:', modules)
  const resources: Resource = {}
  const availableLocales: string[] = []

  const referenceSchema = schemaFromKeys(reference)

  for (const path of Object.keys(modules)) {
    console.debug('Processing locale module:', path, modules[path])
    // path looks like './locales/en.json' -> extract 'en'
    const match = path.match(/.*\/locales\/([^.]+)\.json$/)
    if (!match) {
      console.warn(`Skipping locale module with unexpected path format: ${path}`)
      continue
    }
    const key = match[1]
    // modules[path] may be `{ default: {...} }` when using eager import, or the object itself.
    const mod: unknown = modules[path]
    let translation: Record<string, unknown> | undefined = undefined
    // Use zod to safely parse module shape (some bundlers return { default: {...} })
    const modRec = safeParseOrDefault(mod, referenceSchema, null)
    if (modRec) {
      // modRec may be a record or an object with a `default` property depending on bundler
      if (hasDefaultProp(modRec) && typeof modRec.default === 'object' && modRec.default !== null) {
        const def = safeParseOrDefault(modRec.default, z.record(z.string(), z.unknown()), null)
        if (def) translation = def
      } else if (isRecord(modRec)) {
        translation = modRec
      } else {
        console.warn(`Locale module ${path} has an unexpected shape and will be skipped`)
      }
    }
    if (translation) resources[key] = { translation }
    availableLocales.push(key)
    console.debug(`Loaded locale '${key}' with ${Object.keys(translation ?? {}).length} keys`)
  }

  return { resources, availableLocales }
}
