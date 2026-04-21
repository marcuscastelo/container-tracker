#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  dropLegacyWorktreeDatabaseIfPresent,
  getRepoContext,
  LEGACY_WORKTREE_METADATA_FILE,
  pathExists,
  purgeSupabaseProjectResources,
  readWorktreeState,
  runCommandCapture,
  stopSupabaseProject,
  WORKTREE_STATE_FILE,
} from './db/worktree-db.mjs'

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const context = await getRepoContext(process.cwd(), { requireWorktree: true })

  await assertSafeToDestroy(context, { force })

  const state = await readWorktreeState(context)
  const sharedWorktreeRoot = path.resolve(context.sharedWorktreeRoot)

  if (state?.emancipated?.workdir) {
    const devWorkdir = path.resolve(state.emancipated.workdir)
    const devProjectId = state.emancipated.projectId

    if (
      !devWorkdir.startsWith(`${sharedWorktreeRoot}${path.sep}`) &&
      devWorkdir !== path.join(sharedWorktreeRoot, 'project')
    ) {
      throw new Error(
        `Refusing to destroy emancipated resources outside the current worktree scope: ${devWorkdir}`,
      )
    }

    if (await pathExists(path.join(devWorkdir, 'supabase', 'config.toml'))) {
      try {
        await stopSupabaseProject(devWorkdir, { noBackup: true })
      } catch (error) {
        warn(
          `Failed to stop emancipated stack before cleanup: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    if (typeof devProjectId === 'string' && devProjectId.length > 0) {
      await purgeSupabaseProjectResources(devProjectId, context.worktreePath)
    }
  }

  if (await pathExists(sharedWorktreeRoot)) {
    await fs.rm(sharedWorktreeRoot, { force: true, recursive: true })
  }

  await cleanupLegacyMetadata(context)
  await fs.rm(context.localStatePath, { force: true })
  await fs.rm(path.join(context.worktreePath, WORKTREE_STATE_FILE), { force: true })

  await runCommandCapture(
    'git',
    [
      '-C',
      context.mainRepoPath,
      'worktree',
      'remove',
      ...(force ? ['--force'] : []),
      context.worktreePath,
    ],
    context.mainRepoPath,
  )

  log(`destroyed worktree and local resources: ${context.worktreePath}`)
}

export async function assertSafeToDestroy(context, { force }) {
  if (!context.isWorktree) {
    throw new Error(
      'Refusing to destroy the main checkout. This command only works inside a linked worktree.',
    )
  }

  if (!force) {
    const status = await runCommandCapture(
      'git',
      ['-C', context.worktreePath, 'status', '--porcelain', '--untracked-files=normal'],
      context.worktreePath,
    )

    if (status.stdout.trim().length > 0) {
      throw new Error(
        'Worktree has local changes. Commit/stash/remove them first, or rerun `pnpm destroy-worktree --force` if you intend to discard them.',
      )
    }
  }
}

async function cleanupLegacyMetadata(context) {
  if (!(await pathExists(context.legacyMetadataPath))) {
    return
  }

  try {
    const raw = await fs.readFile(context.legacyMetadataPath, 'utf8')
    const parsed = JSON.parse(raw)
    const databaseName = typeof parsed?.databaseName === 'string' ? parsed.databaseName : null

    if (databaseName) {
      const dropped = await dropLegacyWorktreeDatabaseIfPresent(context.worktreePath, databaseName)

      if (dropped) {
        log(`dropped legacy worktree database: ${databaseName}`)
      }
    }
  } catch (error) {
    warn(
      `Failed to inspect legacy metadata ${LEGACY_WORKTREE_METADATA_FILE}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  } finally {
    await fs.rm(context.legacyMetadataPath, { force: true })
  }
}

function log(message) {
  console.log(`[destroy-worktree] ${message}`)
}

function warn(message) {
  console.warn(`[destroy-worktree] ${message}`)
}

const entrypointPath = process.argv[1]

if (entrypointPath && import.meta.url === pathToFileURL(path.resolve(entrypointPath)).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[destroy-worktree] ${message}`)
    process.exit(1)
  })
}

export const destroyWorktreeScriptPath = fileURLToPath(import.meta.url)
