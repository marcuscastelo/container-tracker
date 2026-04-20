import fs from 'node:fs'
import path from 'node:path'

const emittedExtensions = ['.js', '.mjs', '.cjs', '.json']
const importPatterns = [
  /(from\s+['"])(@agent\/[^'"]+|~\/[^'"]+)(['"])/g,
  /(import\s+['"])(@agent\/[^'"]+|~\/[^'"]+)(['"])/g,
  /(import\(\s*['"])(@agent\/[^'"]+|~\/[^'"]+)(['"]\s*\))/g,
  /(export\s+\*\s+from\s+['"])(@agent\/[^'"]+|~\/[^'"]+)(['"])/g,
  /(export\s+\{[^}]+\}\s+from\s+['"])(@agent\/[^'"]+|~\/[^'"]+)(['"])/g,
]

function walkFiles(rootDir) {
  const pending = [rootDir]
  const files = []

  while (pending.length > 0) {
    const currentDir = pending.pop()
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        pending.push(entryPath)
        continue
      }

      if (entry.isFile() && /\.(js|mjs|cjs)$/.test(entry.name)) {
        files.push(entryPath)
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function resolveAliasBasePath(specifier, distRoot) {
  if (specifier.startsWith('@agent/')) {
    return path.join(distRoot, 'apps', 'agent', 'src', specifier.slice('@agent/'.length))
  }

  if (specifier.startsWith('~/')) {
    return path.join(distRoot, 'src', specifier.slice(2))
  }

  return null
}

function resolveEmittedTarget(basePath) {
  const candidates = [
    basePath,
    ...emittedExtensions.map((extension) => `${basePath}${extension}`),
    ...emittedExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ]

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue
    }

    if (fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

function toRelativeImport(fromFilePath, targetPath) {
  const relativePath = path.relative(path.dirname(fromFilePath), targetPath).replace(/\\/g, '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function rewriteSpecifiers(source, filePath, distRoot) {
  let rewrittenSource = source
  let replacements = 0

  for (const pattern of importPatterns) {
    rewrittenSource = rewrittenSource.replace(pattern, (fullMatch, prefix, specifier, suffix) => {
      const aliasBasePath = resolveAliasBasePath(specifier, distRoot)
      if (aliasBasePath === null) {
        return fullMatch
      }

      const emittedTarget = resolveEmittedTarget(aliasBasePath)
      if (emittedTarget === null) {
        throw new Error(
          `Unable to resolve emitted import target for ${specifier} referenced by ${filePath}`,
        )
      }

      replacements += 1
      return `${prefix}${toRelativeImport(filePath, emittedTarget)}${suffix}`
    })
  }

  return {
    rewrittenSource,
    replacements,
  }
}

function findRemainingAliasImports(source) {
  return importPatterns.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(source)
  })
}

export function rewriteEmittedImports(command) {
  const files = walkFiles(command.distRoot)
  let rewrittenFiles = 0
  let rewrittenImports = 0

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8')
    const { rewrittenSource, replacements } = rewriteSpecifiers(source, filePath, command.distRoot)

    if (replacements > 0) {
      fs.writeFileSync(filePath, rewrittenSource, 'utf8')
      rewrittenFiles += 1
      rewrittenImports += replacements
    }

    if (findRemainingAliasImports(rewrittenSource)) {
      throw new Error(`Unresolved emitted alias import remained in ${filePath}`)
    }
  }

  return {
    rewrittenFiles,
    rewrittenImports,
  }
}
