#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CONFIG_FILE_NAME = '.worktree-initialization.toml'
const FORCE_OVERWRITE_ENV = 'INITIALIZE_WORKTREE_FORCE_OVERWRITE'

export async function main() {
  const worktreePath = process.cwd()
  const gitDir = await resolveGitDir(worktreePath)
  const isWorktree = detectIfWorktree(gitDir)

  if (!isWorktree) {
    fail(
      [
        'Current directory is not a Git worktree.',
        `cwd: ${worktreePath}`,
        '',
        'This command must be executed from inside a linked worktree.',
      ].join('\n'),
    )
  }

  const mainRepoPath = await resolveMainRepoPath(gitDir)
  const configPath = path.join(worktreePath, CONFIG_FILE_NAME)
  const config = await readConfig(configPath)

  log(`worktree: ${worktreePath}`)
  log(`worktree detected: ${gitDir}`)
  log(`main repo: ${mainRepoPath}`)
  log(`config: ${configPath}`)

  await copyDeclaredFiles({
    config,
    mainRepoPath,
    worktreePath,
    forceOverwrite: isTruthyEnv(process.env[FORCE_OVERWRITE_ENV]),
  })

  await runDeclaredCommands({
    config,
    worktreePath,
  })

  log('done')
}

export async function resolveGitDir(cwd) {
  const dotGitPath = path.join(cwd, '.git')

  try {
    const stat = await fs.stat(dotGitPath)

    if (stat.isDirectory()) {
      return dotGitPath
    }

    if (stat.isFile()) {
      const content = await fs.readFile(dotGitPath, 'utf8')
      const match = content.match(/^gitdir:\s*(.+)\s*$/m)

      if (!match) {
        fail(`Unable to parse .git file at ${dotGitPath}`)
      }

      return path.resolve(cwd, match[1])
    }

    fail(`Unsupported .git entry at ${dotGitPath}`)
  } catch (error) {
    fail(`Unable to resolve .git from ${cwd}: ${toErrorMessage(error)}`)
  }
}

export function detectIfWorktree(gitDir) {
  const normalized = path.normalize(gitDir)
  const segments = normalized.split(path.sep)
  return segments.includes('worktrees')
}

export async function resolveMainRepoPath(gitDir) {
  const commondirPath = path.join(gitDir, 'commondir')

  try {
    const raw = await fs.readFile(commondirPath, 'utf8')
    const commonDir = path.resolve(gitDir, raw.trim())
    return path.dirname(path.normalize(commonDir))
  } catch (error) {
    fail(`Unable to resolve main repository path from ${commondirPath}: ${toErrorMessage(error)}`)
  }
}

export async function readConfig(configPath) {
  let raw

  try {
    raw = await fs.readFile(configPath, 'utf8')
  } catch {
    fail(`Config file not found: ${configPath}`)
  }

  const config = parseMinimalToml(raw)

  if (!Array.isArray(config.copy)) {
    config.copy = []
  }

  if (!Array.isArray(config.run)) {
    config.run = []
  }

  return config
}

export function parseMinimalToml(input) {
  const result = {}
  let currentItem = null

  const lines = input.split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const arrayMatch = line.match(/^\[\[(.+)\]\]$/)
    if (arrayMatch) {
      const arrayName = arrayMatch[1].trim()

      if (arrayName !== 'copy' && arrayName !== 'run') {
        fail(`Unsupported TOML array: ${arrayName}`)
      }

      if (!result[arrayName]) {
        result[arrayName] = []
      }

      currentItem = {}
      result[arrayName].push(currentItem)
      continue
    }

    const kvMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/)
    if (!kvMatch) {
      fail(`Unsupported TOML line: ${line}`)
    }

    if (!currentItem) {
      fail(`Key/value found outside array table: ${line}`)
    }

    currentItem[kvMatch[1]] = parseTomlValue(kvMatch[2].trim())
  }

  return result
}

export function parseTomlValue(raw) {
  if (raw === 'true') {
    return true
  }

  if (raw === 'false') {
    return false
  }

  if (raw.startsWith('"') && raw.endsWith('"')) {
    return parseTomlBasicString(raw.slice(1, -1))
  }

  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1)
  }

  if (/^-?\d+$/.test(raw)) {
    return Number(raw)
  }

  fail(`Unsupported TOML value: ${raw}`)
}

export function parseTomlBasicString(raw) {
  return raw.replace(/\\(["\\nrt])/g, (_match, token) => {
    if (token === 'n') {
      return '\n'
    }

    if (token === 'r') {
      return '\r'
    }

    if (token === 't') {
      return '\t'
    }

    return token
  })
}

export async function copyDeclaredFiles({
  config,
  mainRepoPath,
  worktreePath,
  forceOverwrite = false,
}) {
  for (const entry of config.copy) {
    validateCopyEntry(entry)

    const sourcePath = path.resolve(mainRepoPath, entry.source)
    const targetPath = path.resolve(worktreePath, entry.target)
    const overwrite = forceOverwrite || entry.overwrite === true
    const required = entry.required !== false

    ensurePathInsideRoot(mainRepoPath, sourcePath, 'source')
    ensurePathInsideRoot(worktreePath, targetPath, 'target')

    const sourceExists = await pathExists(sourcePath)

    if (!sourceExists) {
      if (required) {
        fail(`Required source file does not exist: ${sourcePath}`)
      }

      warn(`skipping missing optional source: ${sourcePath}`)
      continue
    }

    const targetExists = await pathExists(targetPath)

    if (targetExists && !overwrite) {
      log(`skip existing target: ${entry.target}`)
      continue
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.copyFile(sourcePath, targetPath)

    log(
      `copied ${path.relative(mainRepoPath, sourcePath)} -> ${path.relative(worktreePath, targetPath)}`,
    )
  }
}

export async function runDeclaredCommands({ config, worktreePath }) {
  for (const entry of config.run) {
    validateRunEntry(entry)

    log(`running: ${entry.command}`)

    try {
      await runShellCommand(entry.command, worktreePath)
    } catch (error) {
      if (entry.required === false) {
        warn(`optional command failed: ${entry.command}\n${toErrorMessage(error)}`)
        continue
      }

      throw error
    }
  }
}

export function runShellCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command exited with code ${code}: ${command}`))
    })
  })
}

export function validateCopyEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    fail('Invalid [[copy]] entry')
  }

  if (!isNonEmptyString(entry.source)) {
    fail('[[copy]] entry requires non-empty "source"')
  }

  if (!isNonEmptyString(entry.target)) {
    fail('[[copy]] entry requires non-empty "target"')
  }
}

export function validateRunEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    fail('Invalid [[run]] entry')
  }

  if (!isNonEmptyString(entry.command)) {
    fail('[[run]] entry requires non-empty "command"')
  }
}

export function ensurePathInsideRoot(rootPath, candidatePath, label) {
  const relative = path.relative(rootPath, candidatePath)

  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`Resolved ${label} path escapes root: ${candidatePath}`)
  }
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function isTruthyEnv(value) {
  return typeof value === 'string' && /^(1|true|yes|on)$/i.test(value)
}

export function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function log(message) {
  console.log(`[initialize-worktree] ${message}`)
}

export function warn(message) {
  console.warn(`[initialize-worktree] ${message}`)
}

export function fail(message) {
  console.error(`[initialize-worktree] ${message}`)
  process.exit(1)
}

const entrypointPath = process.argv[1]

if (entrypointPath && import.meta.url === pathToFileURL(path.resolve(entrypointPath)).href) {
  main().catch((error) => {
    console.error(`[initialize-worktree] ${toErrorMessage(error)}`)
    process.exit(1)
  })
}

export const initializeWorktreeScriptPath = fileURLToPath(import.meta.url)
