import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

function resolveAliasBase(specifier: string): string | null {
  if (specifier.startsWith('~/')) {
    return path.join(DIST_ROOT, 'src', specifier.slice(2))
  }

  if (specifier.startsWith('@tools/')) {
    return path.join(DIST_ROOT, 'tools', specifier.slice('@tools/'.length))
  }

  return null
}

function resolveCompiledTarget(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.json`,
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.json'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

export async function resolve(
  specifier: string,
  context: { readonly parentURL?: string },
  defaultResolve: (
    specifier: string,
    context: { readonly parentURL?: string },
  ) => Promise<{ readonly url: string }>,
): Promise<{ readonly shortCircuit?: boolean; readonly url: string }> {
  const aliasBase = resolveAliasBase(specifier)
  if (aliasBase !== null) {
    const targetPath = resolveCompiledTarget(aliasBase)
    if (targetPath !== null) {
      return {
        shortCircuit: true,
        url: pathToFileURL(targetPath).href,
      }
    }
  }

  return defaultResolve(specifier, context)
}
