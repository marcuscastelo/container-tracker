import type { Resource } from 'i18next'
import z from 'zod'
import { safeParseOrDefault } from '~/modules/container-events/infrastructure/persistence/containerEventMappers'
import { hasDefaultProp, isRecord } from '~/shared/utils/typeGuards'

// Dynamically load all locale JSON files from ./locales folder.
// This makes adding a new locale seamless: drop a new JSON file and it will be picked up.
// Vite's import.meta.glob is used with eager import to obtain the parsed JSON at build time.
const modules = import.meta.glob('./locales/*.json', { eager: true })

export function loadProjectResources() {
  const resources: Resource = {}
  const availableLocales: string[] = []
  for (const path of Object.keys(modules)) {
    // path looks like './locales/en.json' -> extract 'en'
    const match = path.match(/\.\/locales\/([^.]+)\.json$/)
    if (!match) continue
    const key = match[1]
    // modules[path] may be `{ default: {...} }` when using eager import, or the object itself.
    const mod: unknown = modules[path]
    let translation: Record<string, unknown> | undefined = undefined
    // Use zod to safely parse module shape (some bundlers return { default: {...} })
    const modRec = safeParseOrDefault(mod, z.record(z.string(), z.unknown()).parse, null)
    if (modRec) {
      // modRec may be a record or an object with a `default` property depending on bundler
      if (hasDefaultProp(modRec) && typeof modRec.default === 'object' && modRec.default !== null) {
        const def = safeParseOrDefault(
          modRec.default,
          z.record(z.string(), z.unknown()).parse,
          null,
        )
        if (def) translation = def
      } else if (isRecord(modRec)) {
        translation = modRec
      }
    }
    if (translation) resources[key] = { translation }
    availableLocales.push(key)
  }

  return { resources, availableLocales }
}
