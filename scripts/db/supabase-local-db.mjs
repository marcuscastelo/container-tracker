#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { TEMPLATE_DATABASE_NAME, WORKTREE_DATABASE_PREFIX } from './worktree-db.mjs'

async function main() {
  const operation = process.argv[2]
  const extraArgs = process.argv.slice(3)

  if (!operation) {
    printUsage()
    process.exit(1)
  }

  if (extraArgs.includes('--db-url')) {
    throw new Error(
      'Do not pass --db-url directly. LOCAL_DB_URL is resolved from local worktree config.',
    )
  }

  if (operation === 'reset') {
    if (extraArgs.length > 0) {
      throw new Error(
        'supabase-local reset does not accept extra flags. Run `pnpm supabase:reset` without extra arguments.',
      )
    }

    await runCommandInherit(
      'node',
      ['./scripts/db/worktree-db.mjs', 'worktree-reset'],
      process.cwd(),
    )
    return
  }

  const localDbUrl = await resolveLocalDbUrl(process.cwd())
  assertIsIsolatedWorktreeDatabaseUrl(localDbUrl)

  const supabaseArgs = buildSupabaseArgs(operation, localDbUrl, extraArgs)
  await runCommandInherit('npx', ['supabase', ...supabaseArgs], process.cwd())
}

function printUsage() {
  console.log(
    '[supabase-local-db] usage: node scripts/db/supabase-local-db.mjs <reset|diff|gen-types> [...flags]',
  )
}

function buildSupabaseArgs(operation, localDbUrl, extraArgs) {
  switch (operation) {
    case 'diff':
      return ['db', 'diff', '--db-url', localDbUrl, ...extraArgs]
    case 'gen-types':
      return ['gen', 'types', '--db-url', localDbUrl, ...extraArgs]
    default:
      throw new Error(`Unsupported operation: ${operation}`)
  }
}

export async function resolveLocalDbUrl(cwd) {
  const fromProcessEnv = normalizeOptional(process.env.LOCAL_DB_URL)
  if (fromProcessEnv) {
    return fromProcessEnv
  }

  const envPath = path.join(cwd, '.env')
  const envExists = await pathExists(envPath)

  if (envExists) {
    const envRaw = await fs.readFile(envPath, 'utf8')
    const envMap = parseDotenvLike(envRaw)
    const fromEnvFile = normalizeOptional(envMap.LOCAL_DB_URL)

    if (fromEnvFile) {
      return fromEnvFile
    }
  }

  const metadataPath = path.join(cwd, '.worktree-db.local.json')
  const metadataExists = await pathExists(metadataPath)

  if (metadataExists) {
    const raw = await fs.readFile(metadataPath, 'utf8')
    const parsed = JSON.parse(raw)
    const fromMetadata = normalizeOptional(parsed?.databaseUrl)

    if (fromMetadata) {
      return fromMetadata
    }
  }

  throw new Error(
    'LOCAL_DB_URL not found. Run `pnpm db:worktree:init` to provision an isolated DB for this worktree.',
  )
}

export function parseDotenvLike(content) {
  const values = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) {
      continue
    }

    const key = match[1]
    const rawValue = match[2]
    values[key] = stripOptionalQuotes(rawValue)
  }

  return values
}

export function assertIsIsolatedWorktreeDatabaseUrl(dbUrl) {
  let parsed

  try {
    parsed = new URL(dbUrl)
  } catch {
    throw new Error(`Invalid LOCAL_DB_URL: ${dbUrl}`)
  }

  const dbName = parsed.pathname.replace(/^\//, '')

  if (!dbName) {
    throw new Error('LOCAL_DB_URL does not contain a database name path.')
  }

  if (dbName === 'postgres') {
    throw new Error(
      'LOCAL_DB_URL points to admin database "postgres". Run `pnpm db:worktree:init` and retry.',
    )
  }

  if (dbName === TEMPLATE_DATABASE_NAME) {
    throw new Error(
      `LOCAL_DB_URL points to template DB (${TEMPLATE_DATABASE_NAME}). This is not allowed.`,
    )
  }

  if (!dbName.startsWith(WORKTREE_DATABASE_PREFIX)) {
    throw new Error(
      `LOCAL_DB_URL must point to a worktree DB (${WORKTREE_DATABASE_PREFIX}*). Current database: ${dbName}`,
    )
  }
}

function stripOptionalQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }

  return value
}

function normalizeOptional(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function runCommandInherit(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command exited with code ${code}: ${command} ${args.join(' ')}`))
    })
  })
}

const entrypointPath = process.argv[1]

if (entrypointPath && import.meta.url === pathToFileURL(path.resolve(entrypointPath)).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[supabase-local-db] ${message}`)
    process.exit(1)
  })
}

export const supabaseLocalDbScriptPath = fileURLToPath(import.meta.url)
