import type { Resource } from 'i18next'
import z from 'zod'
// Dynamically load all locale JSON files from ./locales folder.
// This makes adding a new locale seamless: drop a new JSON file and it will be picked up.
// Vite's import.meta.glob is used with eager import to obtain the parsed JSON at build time.
import { safeParseOrDefault } from '~/modules/container-events/infrastructure/persistence/containerEventMappers'

const modules = import.meta.glob('~/locales/*.json', { eager: true })

function extractLocaleKey(path: string): string | null {
  const match = path.match(/.*\/locales\/([^.]+)\.json$/)
  return match ? match[1] : null
}

function extractTranslation(mod: unknown): Record<string, unknown> | undefined {
  return safeParseOrDefault(mod, z.record(z.string(), z.unknown()).parse, undefined)
}

export function loadProjectResources() {
  console.debug('Loading localization resources from modules:', modules)
  const resources: Resource = {}
  const availableLocales: string[] = []

  for (const path of Object.keys(modules)) {
    console.debug('Processing locale module:', path, modules[path])
    const key = extractLocaleKey(path)
    if (!key) {
      console.warn(`Skipping locale module with unexpected path format: ${path}`)
      continue
    }
    const translation = extractTranslation(modules[path])
    if (translation) resources[key] = { translation }
    else console.warn(`Failed to extract translation from module: ${path}`)
    availableLocales.push(key)
    console.debug(`Loaded locale '${key}' with ${Object.keys(translation ?? {}).length} keys`)
  }

  return { resources, availableLocales }
}
