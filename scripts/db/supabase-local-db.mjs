#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  EMANCIPATED_ENV_MODE,
  pathExists,
  runCommandInherit,
  STAGE_ENV_MODE,
  WORKTREE_STATE_FILE,
} from './worktree-db.mjs'

async function main() {
  const operation = process.argv[2]
  const extraArgs = process.argv.slice(3)

  if (!operation) {
    printUsage()
    process.exit(1)
  }

  const state = await readWorktreeState(process.cwd())

  if (!state) {
    throw new Error(
      `Missing ${WORKTREE_STATE_FILE}. Run \`pnpm initialize-worktree\` from this worktree first.`,
    )
  }

  if (state.mode === STAGE_ENV_MODE) {
    throw new Error(
      'This worktree is bound to shared staging. Structural Supabase commands are blocked here. Run `pnpm db:emancipate` first.',
    )
  }

  if (state.mode !== EMANCIPATED_ENV_MODE) {
    throw new Error(`Unsupported worktree mode for local DB command: ${state.mode}`)
  }

  const workdir = state.emancipated?.workdir

  if (typeof workdir !== 'string' || workdir.trim().length === 0) {
    throw new Error('Emancipated worktree state does not contain a valid Supabase workdir.')
  }

  if (!(await pathExists(path.join(workdir, 'supabase', 'config.toml')))) {
    throw new Error(
      'Emancipated Supabase project is missing on disk. Re-run `pnpm db:emancipate --fresh`.',
    )
  }

  const supabaseArgs = buildSupabaseArgs(operation, workdir, extraArgs)
  await runCommandInherit('npx', ['supabase', ...supabaseArgs], process.cwd())
}

function printUsage() {
  console.log(
    '[supabase-local-db] usage: node scripts/db/supabase-local-db.mjs <reset|diff|gen-types> [...flags]',
  )
}

function buildSupabaseArgs(operation, workdir, extraArgs) {
  switch (operation) {
    case 'reset':
      if (extraArgs.length > 0) {
        throw new Error(
          'supabase:reset does not accept extra flags here. Run `pnpm supabase:reset` without additional arguments.',
        )
      }

      return ['db', 'reset', '--workdir', workdir, '--yes']
    case 'diff':
      return ['db', 'diff', '--workdir', workdir, ...extraArgs]
    case 'gen-types':
      return ['gen', 'types', '--workdir', workdir, ...extraArgs]
    default:
      throw new Error(`Unsupported operation: ${operation}`)
  }
}

async function readWorktreeState(cwd) {
  const statePath = path.join(cwd, WORKTREE_STATE_FILE)

  if (!(await pathExists(statePath))) {
    return null
  }

  const raw = await fs.readFile(statePath, 'utf8')
  return JSON.parse(raw)
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
