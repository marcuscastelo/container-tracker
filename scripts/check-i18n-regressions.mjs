#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

async function findFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx', '.json']) {
  const entries = await readdir(dir, { withFileTypes: true })
  let files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files = files.concat(await findFiles(fullPath, exts))
      continue
    }

    if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const dependencyGroups = [packageJson.dependencies ?? {}, packageJson.devDependencies ?? {}]
  const violations = []

  for (const group of dependencyGroups) {
    if (Object.hasOwn(group, 'i18next')) {
      violations.push('package.json must not include i18next')
    }
    if (Object.hasOwn(group, '@types/i18next')) {
      violations.push('package.json must not include @types/i18next')
    }
  }

  const localeFiles = (await readdir(path.join(ROOT, 'src', 'locales'))).filter((file) =>
    file.endsWith('.json'),
  )

  if (localeFiles.length !== 1 || localeFiles[0] !== 'pt-BR.json') {
    violations.push(
      `src/locales must contain only pt-BR.json; found: ${localeFiles.join(', ') || '(none)'}`,
    )
  }

  const sourceFiles = await findFiles(path.join(ROOT, 'src'), ['.ts', '.tsx'])

  for (const file of sourceFiles) {
    const content = await readFile(file, 'utf8')
    const relativePath = path.relative(ROOT, file)

    if (/from ['"]i18next['"]/.test(content)) {
      violations.push(`${relativePath} must not import i18next`)
    }

    if (/shared\/localization\/(resources|languageSelection)/.test(content)) {
      violations.push(`${relativePath} must not import deleted legacy localization helpers`)
    }
  }

  const entryClientPath = path.join(ROOT, 'src', 'entry-client.tsx')
  const entryClient = await readFile(entryClientPath, 'utf8')

  if (/shared\/localization/.test(entryClient)) {
    violations.push('src/entry-client.tsx must not import shared/localization')
  }

  if (violations.length > 0) {
    console.error('i18n regression guard failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('i18n regression guard: OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
