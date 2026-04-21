#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { detectIfWorktree, resolveGitDir, resolveMainRepoPath } from '../initialize-worktree.mjs'

const execFileAsync = promisify(execFile)

export const WORKTREE_STATE_FILE = '.worktree-state.json'
export const LEGACY_WORKTREE_METADATA_FILE = '.worktree-db.local.json'
export const WORKTREE_MANAGED_BLOCK_START = '# >>> WORKTREE ENV MANAGED BLOCK >>>'
export const WORKTREE_MANAGED_BLOCK_END = '# <<< WORKTREE ENV MANAGED BLOCK <<<'
export const LEGACY_WORKTREE_MANAGED_BLOCK_START = '# >>> WORKTREE DB MANAGED BLOCK >>>'
export const LEGACY_WORKTREE_MANAGED_BLOCK_END = '# <<< WORKTREE DB MANAGED BLOCK <<<'
export const STAGE_ENV_MODE = 'staging'
export const EMANCIPATED_ENV_MODE = 'emancipated'
export const RUNTIME_ROOT_DIR_NAME = 'ct-local-envs'
export const STAGING_PROJECT_DIR_NAME = 'staging'
export const WORKTREES_DIR_NAME = 'worktrees'
export const LOCKS_DIR_NAME = 'locks'
export const STAGING_SNAPSHOT_FILE_NAME = 'staging.dump'
export const PORT_ALLOCATION_LOCK_NAME = 'port-allocation.lock'
export const STAGE_REBUILD_LOCK_NAME = 'stage-rebuild.lock'
export const STAGE_PROJECT_ID_PREFIX = 'ct_stage_'
export const DEV_PROJECT_ID_PREFIX = 'ct_dev_'
export const LEGACY_WORKTREE_DATABASE_PREFIX = 'ct_wt_'
export const DEV_PORT_BASE_MIN = 40000
export const DEV_PORT_BASE_MAX = 64980
export const DEV_PORT_BLOCK_SIZE = 20
export const DEV_PORT_OFFSETS = Object.freeze({
  shadow: 0,
  api: 1,
  db: 2,
  studio: 3,
  inbucket: 4,
  analytics: 7,
  pooler: 9,
})

const REQUIRED_STATUS_KEYS = Object.freeze([
  'API_URL',
  'DB_URL',
  'ANON_KEY',
  'SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'PUBLISHABLE_KEY',
  'SECRET_KEY',
])
const MANAGED_ENV_KEYS = Object.freeze([
  'CT_WORKTREE_ENV_MODE',
  'CT_WORKTREE_ID',
  'CT_SUPABASE_PROJECT_ID',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_JWT_SECRET',
  'AGENT_ENROLL_SUPABASE_URL',
  'AGENT_ENROLL_SUPABASE_ANON_KEY',
  'VITE_PUBLIC_SUPABASE_URL',
  'VITE_PUBLIC_SUPABASE_ANON_KEY',
  'POSTGRES_HOST',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DATABASE',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'LOCAL_DB_URL',
])
const EXCLUDED_SUPABASE_ENTRIES = new Set(['config.toml', '.temp', '.branches'])
const DEFAULT_STAGE_STATUS = 'absent'
const DEFAULT_EMANCIPATED_STATUS = 'absent'

async function main() {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  if (!command) {
    printUsage()
    process.exit(1)
  }

  switch (command) {
    case 'worktree-init':
      await commandWorktreeInit(process.cwd())
      return
    case 'worktree-status':
      await commandWorktreeStatus(process.cwd())
      return
    case 'stage-ensure':
      await commandStageEnsure(process.cwd())
      return
    case 'stage-status':
      await commandStageStatus(process.cwd())
      return
    case 'stage-refresh-local-snapshot':
      await commandStageRefreshLocalSnapshot(process.cwd())
      return
    case 'stage-rebuild':
      await commandStageRebuild(process.cwd())
      return
    case 'emancipate':
      await commandEmancipate(process.cwd(), args)
      return
    case 'rejoin':
      await commandRejoin(process.cwd())
      return
    case 'supabase-start':
      await commandSupabaseStart(process.cwd())
      return
    case 'supabase-stop':
      await commandSupabaseStop(process.cwd())
      return
    case 'supabase-status':
      await commandSupabaseStatus(process.cwd(), false)
      return
    case 'supabase-status-env':
      await commandSupabaseStatus(process.cwd(), true)
      return
    default:
      printUsage()
      throw new Error(`Unsupported command: ${command}`)
  }
}

function printUsage() {
  log('usage: node scripts/db/worktree-db.mjs <command>')
  log(
    [
      'commands:',
      'worktree-init | worktree-status | stage-ensure | stage-status | stage-refresh-local-snapshot | stage-rebuild',
      'emancipate | rejoin | supabase-start | supabase-stop | supabase-status | supabase-status-env',
    ].join(' '),
  )
}

export async function commandWorktreeInit(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: true })
  await ensureEnvFileExists(context)
  const stage = await ensureStageEnvironment(context)
  const previousState = await readWorktreeState(context)
  const nextState = await buildWorktreeState(context, {
    mode: STAGE_ENV_MODE,
    stage,
    previousState,
  })

  await updateManagedEnvBlock(context.envPath, nextState)
  await writeWorktreeState(context, nextState)

  log(`worktree initialized in shared staging mode: ${nextState.worktreeId}`)
}

export async function commandWorktreeStatus(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: true })
  const state = await getWorktreeStateOrDefault(context)

  console.log(JSON.stringify(state, null, 2))
}

export async function commandStageEnsure(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: false })
  const stage = await ensureStageEnvironment(context)

  log(`shared staging ready: ${stage.projectId} (${stage.envMap.API_URL})`)
}

export async function commandStageStatus(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: false })
  const stageDefinition = await getStageDefinition(context)
  const running = await isSupabaseProjectRunning(stageDefinition.workdir)

  console.log(
    JSON.stringify(
      {
        projectId: stageDefinition.projectId,
        workdir: stageDefinition.workdir,
        snapshotPath: stageDefinition.snapshotPath,
        ports: stageDefinition.ports,
        running,
        snapshotExists: await pathExists(stageDefinition.snapshotPath),
      },
      null,
      2,
    ),
  )
}

export async function commandStageRefreshLocalSnapshot(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: false })
  const stage = await ensureStageEnvironment(context)

  await refreshStageSnapshot(context, stage)

  log(`staging snapshot refreshed: ${stage.snapshotPath}`)
}

export async function commandStageRebuild(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: false })

  await withRuntimeLock(context, STAGE_REBUILD_LOCK_NAME, async () => {
    const stageDefinition = await getStageDefinition(context)
    const snapshotExists = await pathExists(stageDefinition.snapshotPath)

    if (await pathExists(stageDefinition.workdir)) {
      if (await isSupabaseProjectRunning(stageDefinition.workdir)) {
        await stopSupabaseProject(stageDefinition.workdir, { noBackup: true })
      }

      await purgeSupabaseProjectResources(stageDefinition.projectId, context.repoRoot)
      await fsp.rm(stageDefinition.workdir, { force: true, recursive: true })
    }

    await materializeStageProject(context)

    await startSupabaseProject(stageDefinition.workdir)

    if (snapshotExists) {
      await restoreBackupIntoRunningProject(stageDefinition.workdir, stageDefinition.snapshotPath)
    }

    const stage = await getRunningStageEnvironment(context)
    await refreshStageSnapshot(context, stage)

    log(`shared staging rebuilt: ${stage.projectId}`)
  })
}

export async function commandEmancipate(cwd, args) {
  const context = await getRepoContext(cwd, { requireWorktree: true })
  await ensureEnvFileExists(context)

  const fresh = args.includes('--fresh')
  const previousState = await getWorktreeStateOrDefault(context)
  const stage = await ensureStageEnvironment(context)

  if (!(await pathExists(stage.snapshotPath))) {
    await refreshStageSnapshot(context, stage)
  }

  if (!fresh && previousState.emancipated.status !== DEFAULT_EMANCIPATED_STATUS) {
    const running = await startExistingEmancipatedProject(context, previousState)
    const nextState = await buildWorktreeState(context, {
      mode: EMANCIPATED_ENV_MODE,
      stage,
      previousState,
      emancipated: running,
    })

    await updateManagedEnvBlock(context.envPath, nextState)
    await writeWorktreeState(context, nextState)
    log(`worktree reattached to preserved dev stack: ${running.projectId}`)
    return
  }

  const emancipated = await createFreshEmancipatedEnvironment(context, stage)
  const nextState = await buildWorktreeState(context, {
    mode: EMANCIPATED_ENV_MODE,
    stage,
    previousState,
    emancipated,
  })

  await updateManagedEnvBlock(context.envPath, nextState)
  await writeWorktreeState(context, nextState)

  log(`worktree emancipated with isolated stack: ${emancipated.projectId}`)
}

export async function commandRejoin(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: true })
  await ensureEnvFileExists(context)
  const previousState = await getWorktreeStateOrDefault(context)

  if (previousState.mode === STAGE_ENV_MODE) {
    const stage = await ensureStageEnvironment(context)
    const nextState = await buildWorktreeState(context, {
      mode: STAGE_ENV_MODE,
      stage,
      previousState,
    })

    await updateManagedEnvBlock(context.envPath, nextState)
    await writeWorktreeState(context, nextState)
    log('worktree already using shared staging')
    return
  }

  const stage = await ensureStageEnvironment(context)
  const runningEmancipated = await resolveEmancipatedEnvironment(context, previousState)

  if (runningEmancipated.status === 'running') {
    await stopSupabaseProject(runningEmancipated.workdir, { noBackup: false })
  }

  const nextState = await buildWorktreeState(context, {
    mode: STAGE_ENV_MODE,
    stage,
    previousState,
    emancipated: {
      ...runningEmancipated,
      status: 'stopped',
      preserved: true,
    },
  })

  await updateManagedEnvBlock(context.envPath, nextState)
  await writeWorktreeState(context, nextState)

  log(`worktree rejoined shared staging: ${stage.projectId}`)
}

export async function commandSupabaseStart(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: false })
  const state = await getWorktreeStateOrDefault(context)

  if (state.mode === EMANCIPATED_ENV_MODE) {
    const running = await startExistingEmancipatedProject(context, state)
    const nextState = await buildWorktreeState(context, {
      mode: EMANCIPATED_ENV_MODE,
      previousState: state,
      stage: await ensureStageEnvironment(context),
      emancipated: running,
    })

    if (context.isWorktree) {
      await updateManagedEnvBlock(context.envPath, nextState)
      await writeWorktreeState(context, nextState)
    }

    return
  }

  await ensureStageEnvironment(context)
}

export async function commandSupabaseStop(cwd) {
  const context = await getRepoContext(cwd, { requireWorktree: true })
  const state = await getWorktreeStateOrDefault(context)

  if (state.mode !== EMANCIPATED_ENV_MODE) {
    throw new Error(
      'Refusing to stop shared staging from a non-emancipated worktree. Use `pnpm db:rejoin` or operate on the isolated stack only.',
    )
  }

  const emancipated = await resolveEmancipatedEnvironment(context, state)

  if (emancipated.status !== 'running') {
    log(`isolated stack already stopped: ${emancipated.projectId}`)
    return
  }

  await stopSupabaseProject(emancipated.workdir, { noBackup: false })

  const nextState = await buildWorktreeState(context, {
    mode: EMANCIPATED_ENV_MODE,
    stage: await ensureStageEnvironment(context),
    previousState: state,
    emancipated: {
      ...emancipated,
      status: 'stopped',
      preserved: true,
    },
  })

  await writeWorktreeState(context, nextState)

  log(`isolated stack stopped: ${emancipated.projectId}`)
}

export async function commandSupabaseStatus(cwd, envOutput) {
  const context = await getRepoContext(cwd, { requireWorktree: false })
  const state = await getWorktreeStateOrDefault(context)
  const workdir =
    state.mode === EMANCIPATED_ENV_MODE
      ? state.emancipated.workdir
      : (await getStageDefinition(context)).workdir

  const args = ['supabase', 'status', '--workdir', workdir]

  if (envOutput) {
    args.push('-o', 'env')
  }

  await runCommandInherit('npx', args, cwd)
}

export async function getRepoContext(cwd, { requireWorktree }) {
  const repoRoot = await getGitTopLevel(cwd)
  const gitDir = await resolveGitDir(repoRoot)
  const isWorktree = detectIfWorktree(gitDir)

  if (requireWorktree && !isWorktree) {
    throw new Error('This command must be executed from inside a linked Git worktree.')
  }

  const gitCommonDir = await getGitCommonDir(repoRoot)
  const mainRepoPath = isWorktree ? await resolveMainRepoPath(gitDir) : repoRoot
  const worktreePath = repoRoot
  const worktreeId = buildWorktreeId(worktreePath)
  const runtimeRoot = path.join(gitCommonDir, RUNTIME_ROOT_DIR_NAME)
  const stageRoot = path.join(runtimeRoot, STAGING_PROJECT_DIR_NAME)
  const worktreesRoot = path.join(runtimeRoot, WORKTREES_DIR_NAME)
  const locksRoot = path.join(runtimeRoot, LOCKS_DIR_NAME)
  const stageProjectWorkdir = path.join(stageRoot, 'project')
  const sharedWorktreeRoot = path.join(worktreesRoot, worktreeId)
  const sharedStatePath = path.join(sharedWorktreeRoot, 'state.json')
  const localStatePath = path.join(worktreePath, WORKTREE_STATE_FILE)
  const legacyMetadataPath = path.join(worktreePath, LEGACY_WORKTREE_METADATA_FILE)
  const envPath = path.join(worktreePath, '.env')

  return {
    cwd: path.resolve(cwd),
    repoRoot,
    worktreePath,
    worktreeName: path.basename(worktreePath),
    gitBranch: await getCurrentGitBranch(repoRoot),
    gitCommonDir,
    gitDir,
    isWorktree,
    mainRepoPath: path.resolve(mainRepoPath),
    worktreeId,
    envPath,
    localStatePath,
    legacyMetadataPath,
    runtimeRoot,
    stageRoot,
    stageProjectWorkdir,
    stageSnapshotPath: path.join(stageRoot, 'snapshots', STAGING_SNAPSHOT_FILE_NAME),
    worktreesRoot,
    sharedWorktreeRoot,
    sharedStatePath,
    locksRoot,
  }
}

export async function getWorktreeStateOrDefault(context) {
  const existing = await readWorktreeState(context)

  if (existing) {
    return normalizeWorktreeState(existing, context)
  }

  return buildDefaultWorktreeState(context)
}

export async function readWorktreeState(context) {
  const candidates = [context.localStatePath, context.sharedStatePath]

  for (const candidatePath of candidates) {
    if (!(await pathExists(candidatePath))) {
      continue
    }

    const raw = await fsp.readFile(candidatePath, 'utf8')
    return JSON.parse(raw)
  }

  return null
}

export async function writeWorktreeState(context, state) {
  const normalized = normalizeWorktreeState(state, context)
  const payload = `${JSON.stringify(sanitizeStateForPersistence(normalized), null, 2)}\n`

  await fsp.mkdir(path.dirname(context.localStatePath), { recursive: true })
  await fsp.mkdir(path.dirname(context.sharedStatePath), { recursive: true })
  await fsp.writeFile(context.localStatePath, payload)
  await fsp.writeFile(context.sharedStatePath, payload)

  log(`wrote worktree state: ${context.localStatePath}`)
}

export async function buildWorktreeState(
  context,
  { mode, stage, previousState = null, emancipated = null },
) {
  const stageDefinition = stage ?? (await getStageDefinition(context))
  const previous = previousState ? normalizeWorktreeState(previousState, context) : null
  const nextEmancipated =
    emancipated ??
    (previous
      ? await resolveEmancipatedEnvironment(context, previous)
      : await getDefaultEmancipated(context))

  return normalizeWorktreeState(
    {
      version: 2,
      worktreeId: context.worktreeId,
      worktreePath: context.worktreePath,
      gitBranch: context.gitBranch,
      mode,
      staging: {
        projectId: stageDefinition.projectId,
        workdir: stageDefinition.workdir,
        snapshotPath: stageDefinition.snapshotPath,
        ports: stageDefinition.ports,
        status: stageDefinition.status,
        envMap: stageDefinition.envMap ?? null,
      },
      emancipated: nextEmancipated,
      generatedFiles: ['.env', WORKTREE_STATE_FILE],
    },
    context,
  )
}

export function normalizeWorktreeState(rawState, context) {
  const stageDefinition = {
    projectId: rawState?.staging?.projectId ?? buildStageProjectId(context.mainRepoPath),
    workdir: rawState?.staging?.workdir ?? context.stageProjectWorkdir,
    snapshotPath: rawState?.staging?.snapshotPath ?? context.stageSnapshotPath,
    ports: rawState?.staging?.ports ?? null,
    status: rawState?.staging?.status ?? DEFAULT_STAGE_STATUS,
    envMap: rawState?.staging?.envMap ?? null,
  }
  const emancipatedDefinition = {
    projectId: rawState?.emancipated?.projectId ?? buildDevProjectId(context.worktreeId),
    workdir: rawState?.emancipated?.workdir ?? path.join(context.sharedWorktreeRoot, 'project'),
    ports: rawState?.emancipated?.ports ?? null,
    status: rawState?.emancipated?.status ?? DEFAULT_EMANCIPATED_STATUS,
    preserved: rawState?.emancipated?.preserved ?? false,
    envMap: rawState?.emancipated?.envMap ?? null,
  }

  return {
    version: 2,
    worktreeId: context.worktreeId,
    worktreePath: context.worktreePath,
    gitBranch: context.gitBranch,
    mode: rawState?.mode === EMANCIPATED_ENV_MODE ? EMANCIPATED_ENV_MODE : STAGE_ENV_MODE,
    staging: stageDefinition,
    emancipated: emancipatedDefinition,
    generatedFiles: Array.isArray(rawState?.generatedFiles)
      ? [...new Set(rawState.generatedFiles)]
      : ['.env', WORKTREE_STATE_FILE],
  }
}

export function buildDefaultWorktreeState(context) {
  return normalizeWorktreeState(
    {
      mode: STAGE_ENV_MODE,
    },
    context,
  )
}

export async function ensureStageEnvironment(context) {
  const stageDefinition = await getStageDefinition(context)

  await materializeStageProject(context)

  if (!(await isSupabaseProjectRunning(stageDefinition.workdir))) {
    log('shared staging is not running; starting shared stack...')
    await startSupabaseProject(stageDefinition.workdir)
  }

  return getRunningStageEnvironment(context)
}

export async function getRunningStageEnvironment(context) {
  const stageDefinition = await getStageDefinition(context)
  const envMap = await getSupabaseStatusEnvMap(stageDefinition.workdir)

  return {
    ...stageDefinition,
    envMap,
    status: 'running',
  }
}

export async function getStageDefinition(context) {
  const scaffold = await resolveStageScaffold(context)
  const ports = readSupabasePortsFromConfig(scaffold.rawTemplate)

  return {
    projectId: scaffold.projectId,
    workdir: context.stageProjectWorkdir,
    snapshotPath: context.stageSnapshotPath,
    ports,
    status: (await isSupabaseProjectRunning(context.stageProjectWorkdir)) ? 'running' : 'stopped',
  }
}

export async function materializeStageProject(context) {
  const targetSupabaseDir = path.join(context.stageProjectWorkdir, 'supabase')
  const scaffold = await resolveStageScaffold(context)

  await fsp.mkdir(context.stageProjectWorkdir, { recursive: true })

  if (!(await pathExists(targetSupabaseDir))) {
    await copySupabaseDirectory(
      scaffold.sourceSupabaseDir,
      targetSupabaseDir,
      EXCLUDED_SUPABASE_ENTRIES,
    )
  }

  const rendered = renderSupabaseConfig(scaffold.rawTemplate, {
    projectId: scaffold.projectId,
    ports: readSupabasePortsFromConfig(scaffold.rawTemplate),
  })

  await fsp.writeFile(path.join(targetSupabaseDir, 'config.toml'), rendered)
  log(`materialized shared staging project at ${context.stageProjectWorkdir}`)
}

export async function createFreshEmancipatedEnvironment(context, stage) {
  const devDefinition = await prepareEmancipatedDefinition(context, null)

  await purgeSupabaseProjectResources(devDefinition.projectId, context.worktreePath)

  if (await pathExists(devDefinition.workdir)) {
    await fsp.rm(devDefinition.workdir, { force: true, recursive: true })
  }

  await materializeEmancipatedProject(context, devDefinition)
  await startSupabaseProject(devDefinition.workdir)
  await restoreBackupIntoRunningProject(devDefinition.workdir, stage.snapshotPath)

  const envMap = await getSupabaseStatusEnvMap(devDefinition.workdir)

  return {
    ...devDefinition,
    envMap,
    status: 'running',
    preserved: true,
  }
}

export async function startExistingEmancipatedProject(context, previousState) {
  const definition = await resolveEmancipatedEnvironment(context, previousState)

  if (!(await pathExists(definition.workdir))) {
    return createFreshEmancipatedEnvironment(context, await ensureStageEnvironment(context))
  }

  await materializeEmancipatedProject(context, definition)

  if (!(await isSupabaseProjectRunning(definition.workdir))) {
    log(`starting isolated stack for ${definition.projectId}`)
    await startSupabaseProject(definition.workdir)
  }

  return {
    ...definition,
    envMap: await getSupabaseStatusEnvMap(definition.workdir),
    status: 'running',
    preserved: true,
  }
}

export async function resolveEmancipatedEnvironment(context, previousState) {
  if (!previousState) {
    return getDefaultEmancipated(context)
  }

  const normalized = normalizeWorktreeState(previousState, context)
  const definition = await prepareEmancipatedDefinition(context, normalized.emancipated)
  const running = await isSupabaseProjectRunning(definition.workdir)

  if (!running) {
    return {
      ...definition,
      status: (await pathExists(definition.workdir)) ? 'stopped' : 'absent',
      preserved: await pathExists(definition.workdir),
    }
  }

  return {
    ...definition,
    envMap: await getSupabaseStatusEnvMap(definition.workdir),
    status: 'running',
    preserved: true,
  }
}

export function getDefaultEmancipated(context) {
  return prepareEmancipatedDefinition(context, null)
}

export async function prepareEmancipatedDefinition(context, existingDefinition) {
  const projectId = buildDevProjectId(context.worktreeId)
  const ports =
    (existingDefinition?.ports ? normalizeAllocatedPorts(existingDefinition.ports) : null) ??
    (await allocateDevPorts(context, {
      projectId,
    }))

  return {
    projectId,
    workdir: path.join(context.sharedWorktreeRoot, 'project'),
    ports,
    status: existingDefinition?.status ?? DEFAULT_EMANCIPATED_STATUS,
    preserved: existingDefinition?.preserved ?? false,
  }
}

export async function materializeEmancipatedProject(context, definition) {
  const sourceSupabaseDir = path.join(context.worktreePath, 'supabase')
  const targetSupabaseDir = path.join(definition.workdir, 'supabase')

  await fsp.mkdir(targetSupabaseDir, { recursive: true })
  await fsp.mkdir(path.join(targetSupabaseDir, '.temp'), { recursive: true })
  await ensureSupabaseSymlinkSet(sourceSupabaseDir, targetSupabaseDir)

  const rawTemplate = await fsp.readFile(path.join(sourceSupabaseDir, 'config.toml'), 'utf8')
  const rendered = renderSupabaseConfig(rawTemplate, {
    projectId: definition.projectId,
    ports: definition.ports,
  })

  await fsp.writeFile(path.join(targetSupabaseDir, 'config.toml'), rendered)
}

export async function ensureSupabaseSymlinkSet(sourceSupabaseDir, targetSupabaseDir) {
  const entries = await fsp.readdir(sourceSupabaseDir, { withFileTypes: true })

  for (const entry of entries) {
    if (EXCLUDED_SUPABASE_ENTRIES.has(entry.name)) {
      continue
    }

    const sourcePath = path.join(sourceSupabaseDir, entry.name)
    const targetPath = path.join(targetSupabaseDir, entry.name)
    const relativeSource = path.relative(path.dirname(targetPath), sourcePath)
    const targetExists = await pathExists(targetPath)

    if (targetExists) {
      const stat = await fsp.lstat(targetPath)

      if (stat.isSymbolicLink()) {
        const currentTarget = await fsp.readlink(targetPath)
        if (currentTarget === relativeSource) {
          continue
        }
      }

      await fsp.rm(targetPath, { force: true, recursive: true })
    }

    const symlinkType = entry.isDirectory() ? 'dir' : 'file'
    await fsp.symlink(relativeSource, targetPath, symlinkType)
  }
}

export async function refreshStageSnapshot(_context, stage) {
  await fsp.mkdir(path.dirname(stage.snapshotPath), { recursive: true })
  await dumpDatabaseToFile({
    workdir: stage.workdir,
    outputPath: stage.snapshotPath,
  })
}

export async function dumpDatabaseToFile({ workdir, outputPath }) {
  const envMap = await getSupabaseStatusEnvMap(workdir)
  const dbUrl = requiredStatusValue(envMap, 'DB_URL')
  const containerName = await resolveSupabaseDbContainerName(workdir)
  const parsed = new URL(dbUrl)
  const databaseName = parsed.pathname.replace(/^\//, '') || 'postgres'
  const username = decodeURIComponent(parsed.username || 'postgres')
  const password = decodeURIComponent(parsed.password || 'postgres')

  await pipeDockerCommandToFile({
    outputPath,
    command: 'docker',
    args: [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'pg_dump',
      '-h',
      'localhost',
      '-U',
      username,
      '-d',
      databaseName,
      '-Fc',
      '--data-only',
      '--schema=public',
      '--no-owner',
      '--no-privileges',
    ],
  })
}

export async function startSupabaseProject(workdir) {
  await runCommandInherit('npx', ['supabase', 'start', '--workdir', workdir], workdir)
}

export async function restoreBackupIntoRunningProject(workdir, backupPath) {
  const envMap = await getSupabaseStatusEnvMap(workdir)
  const dbUrl = requiredStatusValue(envMap, 'DB_URL')
  const containerName = await resolveSupabaseDbContainerName(workdir)
  const parsed = new URL(dbUrl)
  const databaseName = parsed.pathname.replace(/^\//, '') || 'postgres'
  const username = decodeURIComponent(parsed.username || 'postgres')
  const password = decodeURIComponent(parsed.password || 'postgres')

  await truncatePublicTables(workdir, {
    containerName,
    databaseName,
    username,
    password,
  })

  await pipeFileToDockerCommand({
    inputPath: backupPath,
    command: 'docker',
    args: [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'pg_restore',
      '-h',
      'localhost',
      '-U',
      username,
      '-d',
      databaseName,
      '--data-only',
      '--schema=public',
      '--no-owner',
      '--no-privileges',
    ],
  })
}

export async function truncatePublicTables(
  workdir,
  { containerName, databaseName, username, password },
) {
  const sql = [
    'do $$',
    'declare truncate_sql text;',
    'begin',
    "  select string_agg(format('truncate table %I.%I restart identity cascade', schemaname, tablename), '; ')",
    '    into truncate_sql',
    '  from pg_tables',
    "  where schemaname = 'public';",
    '  if truncate_sql is not null then',
    '    execute truncate_sql;',
    '  end if;',
    'end',
    '$$;',
  ].join('\n')

  await runCommandCapture(
    'docker',
    [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'psql',
      '-h',
      'localhost',
      '-U',
      username,
      '-d',
      databaseName,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    workdir,
  )
}

export async function stopSupabaseProject(workdir, { noBackup }) {
  const args = ['supabase', 'stop', '--workdir', workdir]

  if (noBackup) {
    args.push('--no-backup')
  }

  await runCommandInherit('npx', args, workdir)
}

export async function purgeSupabaseProjectResources(projectId, cwd) {
  await removeDockerResourcesByLabel({
    commandGroup: ['ps', '-aq'],
    removeGroup: ['rm', '-f'],
    cwd,
    projectId,
    resourceType: 'containers',
  })
  await removeDockerResourcesByLabel({
    commandGroup: ['network', 'ls', '-q'],
    removeGroup: ['network', 'rm'],
    cwd,
    projectId,
    resourceType: 'networks',
  })
  await removeDockerResourcesByLabel({
    commandGroup: ['volume', 'ls', '-q'],
    removeGroup: ['volume', 'rm', '-f'],
    cwd,
    projectId,
    resourceType: 'volumes',
  })
}

export async function isSupabaseProjectRunning(workdir) {
  if (!(await pathExists(path.join(workdir, 'supabase', 'config.toml')))) {
    return false
  }

  try {
    await runCommandCapture(
      'npx',
      ['supabase', 'status', '-o', 'env', '--workdir', workdir],
      workdir,
    )
    return true
  } catch {
    return false
  }
}

export async function removeDockerResourcesByLabel({
  commandGroup,
  removeGroup,
  cwd,
  projectId,
  resourceType,
}) {
  const listResult = await runCommandCapture(
    'docker',
    [...commandGroup, '--filter', `label=com.supabase.cli.project=${projectId}`],
    cwd,
  )
  const resourceIds = listResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (resourceIds.length === 0) {
    return
  }

  await runCommandCapture('docker', [...removeGroup, ...resourceIds], cwd)
  log(`purged ${resourceType} for Supabase project ${projectId}`)
}

export async function getSupabaseStatusEnvMap(workdir) {
  const result = await runCommandCapture(
    'npx',
    ['supabase', 'status', '-o', 'env', '--workdir', workdir],
    workdir,
  )
  const envMap = parseSupabaseStatusEnvOutput(result.stdout)

  for (const key of REQUIRED_STATUS_KEYS) {
    requiredStatusValue(envMap, key)
  }

  return envMap
}

export async function updateManagedEnvBlock(envPath, state) {
  if (!(await pathExists(envPath))) {
    throw new Error(
      `Missing .env at ${envPath}. Run initialize-worktree first so the base file exists before environment binding.`,
    )
  }

  const current = await fsp.readFile(envPath, 'utf8')
  const updated = upsertManagedEnvBlock(current, state)

  if (updated === current) {
    log('.env already bound to the expected local environment')
    return
  }

  await fsp.writeFile(envPath, updated)
  log(`updated managed environment block in ${envPath}`)
}

export function upsertManagedEnvBlock(content, state) {
  const replacement = renderManagedEnvBlock(state)
  const markerCandidates = [
    [WORKTREE_MANAGED_BLOCK_START, WORKTREE_MANAGED_BLOCK_END],
    [LEGACY_WORKTREE_MANAGED_BLOCK_START, LEGACY_WORKTREE_MANAGED_BLOCK_END],
  ]

  const workingContent = content

  for (const [startMarker, endMarker] of markerCandidates) {
    const startCount = countOccurrences(workingContent, startMarker)
    const endCount = countOccurrences(workingContent, endMarker)

    if (startCount !== endCount) {
      throw new Error('Managed environment block markers are unbalanced in .env.')
    }

    if (startCount > 1) {
      throw new Error('Managed environment block appears multiple times in .env.')
    }

    if (startCount === 0) {
      continue
    }

    const startIndex = workingContent.indexOf(startMarker)
    const endIndex = workingContent.indexOf(endMarker)
    const endMarkerEndIndex = endIndex + endMarker.length
    const before = workingContent.slice(0, startIndex)
    const after = workingContent.slice(endMarkerEndIndex)

    const sanitized = stripManagedEnvAssignments(`${before}${after}`)
    const normalized = sanitized.endsWith('\n') ? sanitized : `${sanitized}\n`
    return `${normalized.trimEnd()}\n\n${replacement}\n`
  }

  const sanitized = stripManagedEnvAssignments(workingContent)
  const normalized = sanitized.endsWith('\n') ? sanitized : `${sanitized}\n`
  return `${normalized.trimEnd()}\n\n${replacement}\n`
}

export function renderManagedEnvBlock(state) {
  const active = getActiveEnvironment(state)
  const envMap = active.envMap

  if (!envMap) {
    throw new Error('Cannot render managed env block without active Supabase status env values.')
  }

  const databaseUrl = requiredStatusValue(envMap, 'DB_URL')
  const apiUrl = requiredStatusValue(envMap, 'API_URL')
  const parsedDbUrl = new URL(databaseUrl)
  const databaseName = parsedDbUrl.pathname.replace(/^\//, '')
  const dbUser = decodeURIComponent(parsedDbUrl.username || 'postgres')
  const dbPassword = decodeURIComponent(parsedDbUrl.password || 'postgres')

  return [
    WORKTREE_MANAGED_BLOCK_START,
    '# This block is auto-generated by local worktree environment tooling.',
    '# Do not edit manually. Re-run `pnpm db:worktree:init`, `pnpm db:emancipate`, or `pnpm db:rejoin`.',
    `CT_WORKTREE_ENV_MODE="${state.mode}"`,
    `CT_WORKTREE_ID="${state.worktreeId}"`,
    `CT_SUPABASE_PROJECT_ID="${active.projectId}"`,
    `SUPABASE_URL="${apiUrl}"`,
    `SUPABASE_ANON_KEY="${requiredStatusValue(envMap, 'ANON_KEY')}"`,
    `SUPABASE_SERVICE_ROLE_KEY="${requiredStatusValue(envMap, 'SERVICE_ROLE_KEY')}"`,
    `SUPABASE_PUBLISHABLE_KEY="${requiredStatusValue(envMap, 'PUBLISHABLE_KEY')}"`,
    `SUPABASE_SECRET_KEY="${requiredStatusValue(envMap, 'SECRET_KEY')}"`,
    `SUPABASE_JWT_SECRET="${requiredStatusValue(envMap, 'JWT_SECRET')}"`,
    `AGENT_ENROLL_SUPABASE_URL="${apiUrl}"`,
    `AGENT_ENROLL_SUPABASE_ANON_KEY="${requiredStatusValue(envMap, 'ANON_KEY')}"`,
    `VITE_PUBLIC_SUPABASE_URL="${apiUrl}"`,
    `VITE_PUBLIC_SUPABASE_ANON_KEY="${requiredStatusValue(envMap, 'ANON_KEY')}"`,
    `POSTGRES_HOST="${parsedDbUrl.hostname}"`,
    `POSTGRES_USER="${dbUser}"`,
    `POSTGRES_PASSWORD="${dbPassword}"`,
    `POSTGRES_DATABASE="${databaseName}"`,
    `POSTGRES_URL="${databaseUrl}"`,
    `POSTGRES_URL_NON_POOLING="${databaseUrl}"`,
    `POSTGRES_PRISMA_URL="${databaseUrl}"`,
    `LOCAL_DB_URL="${databaseUrl}"`,
    WORKTREE_MANAGED_BLOCK_END,
  ].join('\n')
}

export function getActiveEnvironment(state) {
  if (state.mode === EMANCIPATED_ENV_MODE) {
    return state.emancipated
  }

  return state.staging
}

export function sanitizeStateForPersistence(state) {
  return {
    ...state,
    staging: {
      ...state.staging,
      envMap: undefined,
    },
    emancipated: {
      ...state.emancipated,
      envMap: undefined,
    },
  }
}

export function stripManagedEnvAssignments(content) {
  const managedKeys = new Set(MANAGED_ENV_KEYS)

  return content
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)

      if (!match) {
        return true
      }

      return !managedKeys.has(match[1])
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function buildWorktreeId(worktreePath) {
  const sanitized =
    sanitizeIdentifierSegment(path.basename(path.resolve(worktreePath))) || 'worktree'
  return `${sanitized}_${hashString(path.resolve(worktreePath), 8)}`
}

export function buildStageProjectId(mainRepoPath) {
  return `${STAGE_PROJECT_ID_PREFIX}${hashString(path.resolve(mainRepoPath), 8)}`
}

export function buildDevProjectId(worktreeId) {
  return `${DEV_PROJECT_ID_PREFIX}${worktreeId}`
}

export function sanitizeIdentifierSegment(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function allocateDevPorts(context, { projectId }) {
  return withRuntimeLock(context, PORT_ALLOCATION_LOCK_NAME, async () => {
    const states = await readSharedWorktreeStates(context)
    const existing = states.find((state) => state.emancipated?.projectId === projectId)

    if (existing?.emancipated?.ports?.shadow) {
      return normalizeAllocatedPorts(existing.emancipated.ports)
    }

    const slotCount = Math.floor((DEV_PORT_BASE_MAX - DEV_PORT_BASE_MIN) / DEV_PORT_BLOCK_SIZE) + 1
    const usedBases = new Set(
      states
        .map((state) => state.emancipated?.ports?.shadow)
        .filter((value) => typeof value === 'number')
        .map((shadowPort) => shadowPort),
    )

    let slotIndex = Number.parseInt(hashString(projectId, 6), 16) % slotCount

    for (let attempt = 0; attempt < slotCount; attempt += 1) {
      const basePort = DEV_PORT_BASE_MIN + slotIndex * DEV_PORT_BLOCK_SIZE

      if (!usedBases.has(basePort)) {
        return buildPortMap(basePort)
      }

      slotIndex = (slotIndex + 1) % slotCount
    }

    throw new Error('Unable to allocate a free deterministic dev port block for this worktree.')
  })
}

export function buildPortMap(basePort) {
  return {
    shadow: basePort + DEV_PORT_OFFSETS.shadow,
    api: basePort + DEV_PORT_OFFSETS.api,
    db: basePort + DEV_PORT_OFFSETS.db,
    studio: basePort + DEV_PORT_OFFSETS.studio,
    inbucket: basePort + DEV_PORT_OFFSETS.inbucket,
    analytics: basePort + DEV_PORT_OFFSETS.analytics,
    pooler: basePort + DEV_PORT_OFFSETS.pooler,
  }
}

export function normalizeAllocatedPorts(ports) {
  if (typeof ports?.shadow !== 'number') {
    throw new Error('Cannot normalize allocated ports without a shadow/base port.')
  }

  return {
    ...buildPortMap(ports.shadow),
    ...ports,
  }
}

export async function readSharedWorktreeStates(context) {
  if (!(await pathExists(context.worktreesRoot))) {
    return []
  }

  const entries = await fsp.readdir(context.worktreesRoot, { withFileTypes: true })
  const states = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const statePath = path.join(context.worktreesRoot, entry.name, 'state.json')

    if (!(await pathExists(statePath))) {
      continue
    }

    const raw = await fsp.readFile(statePath, 'utf8')
    states.push(JSON.parse(raw))
  }

  return states
}

export function renderSupabaseConfig(rawTemplate, { projectId, ports }) {
  let rendered = rawTemplate

  rendered = replaceTomlAssignment(rendered, null, 'project_id', `"${projectId}"`)
  rendered = replaceTomlAssignment(rendered, 'api', 'port', String(ports.api))
  rendered = replaceTomlAssignment(rendered, 'db', 'port', String(ports.db))
  rendered = replaceTomlAssignment(rendered, 'db', 'shadow_port', String(ports.shadow))

  if (rawTemplate.includes('[db.pooler]')) {
    rendered = replaceTomlAssignment(rendered, 'db.pooler', 'port', String(ports.pooler))
  }

  if (rawTemplate.includes('[studio]')) {
    rendered = replaceTomlAssignment(rendered, 'studio', 'port', String(ports.studio))
  }

  if (rawTemplate.includes('[inbucket]')) {
    rendered = replaceTomlAssignment(rendered, 'inbucket', 'port', String(ports.inbucket))
  }

  if (rawTemplate.includes('[analytics]')) {
    rendered = replaceTomlAssignment(rendered, 'analytics', 'port', String(ports.analytics))
  }

  return rendered
}

export function readSupabasePortsFromConfig(rawTemplate) {
  return {
    api: readTomlAssignmentNumber(rawTemplate, 'api', 'port'),
    db: readTomlAssignmentNumber(rawTemplate, 'db', 'port'),
    shadow: readTomlAssignmentNumber(rawTemplate, 'db', 'shadow_port'),
    studio: readTomlAssignmentNumber(rawTemplate, 'studio', 'port'),
    inbucket: readTomlAssignmentNumber(rawTemplate, 'inbucket', 'port'),
    analytics: rawTemplate.includes('[analytics]')
      ? readTomlAssignmentNumber(rawTemplate, 'analytics', 'port')
      : DEV_PORT_BASE_MIN + DEV_PORT_OFFSETS.analytics,
    pooler: rawTemplate.includes('[db.pooler]')
      ? readTomlAssignmentNumber(rawTemplate, 'db.pooler', 'port')
      : DEV_PORT_BASE_MIN + DEV_PORT_OFFSETS.pooler,
  }
}

export function replaceTomlAssignment(rawTemplate, sectionName, key, value) {
  const lines = rawTemplate.split(/\r?\n/)
  let activeSection = null
  let replaced = false

  for (let index = 0; index < lines.length; index += 1) {
    const sectionMatch = lines[index].match(/^\s*\[([^\]]+)\]\s*$/)

    if (sectionMatch) {
      activeSection = sectionMatch[1]
      continue
    }

    const isTargetSection =
      sectionName === null ? activeSection === null : activeSection === sectionName

    if (!isTargetSection) {
      continue
    }

    if (new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`).test(lines[index])) {
      lines[index] = `${key} = ${value}`
      replaced = true
      break
    }
  }

  if (!replaced) {
    throw new Error(`Unable to replace TOML assignment ${sectionName ?? '<root>'}.${key}`)
  }

  return `${lines.join('\n')}${rawTemplate.endsWith('\n') ? '\n' : ''}`.replace(/\n\n$/u, '\n')
}

export function readTomlAssignmentNumber(rawTemplate, sectionName, key) {
  const lines = rawTemplate.split(/\r?\n/)
  let activeSection = null

  for (const line of lines) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/)

    if (sectionMatch) {
      activeSection = sectionMatch[1]
      continue
    }

    if (activeSection !== sectionName) {
      continue
    }

    const match = line.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(\\d+)\\s*$`))

    if (match) {
      return Number.parseInt(match[1], 10)
    }
  }

  throw new Error(`Unable to read TOML assignment ${sectionName}.${key}`)
}

export async function copySupabaseDirectory(sourceDir, targetDir, excludedNames) {
  await fsp.mkdir(targetDir, { recursive: true })
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (excludedNames.has(entry.name)) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    await fsp.cp(sourcePath, targetPath, {
      errorOnExist: false,
      force: true,
      recursive: true,
    })
  }
}

export async function withRuntimeLock(context, fileName, operation) {
  await fsp.mkdir(context.locksRoot, { recursive: true })
  const lockPath = path.join(context.locksRoot, fileName)
  const timeoutMs = 120_000
  const pollMs = 500
  const startedAt = Date.now()
  let handle = null

  while (!handle) {
    try {
      handle = await fsp.open(lockPath, 'wx')
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`)
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'EEXIST') {
        if (Date.now() - startedAt >= timeoutMs) {
          throw new Error(`Timed out waiting for local runtime lock: ${lockPath}`)
        }

        await sleep(pollMs)
        continue
      }

      throw error
    }
  }

  try {
    return await operation()
  } finally {
    await handle.close()
    await fsp.rm(lockPath, { force: true })
  }
}

export function parseSupabaseStatusEnvOutput(output) {
  const envMap = {}

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('Stopped services:')) {
      continue
    }

    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) {
      continue
    }

    envMap[match[1]] = stripEnvValueQuotes(match[2].trim())
  }

  return envMap
}

export async function resolveSupabaseDbContainerName(workdir) {
  const projectId = await readSupabaseProjectId(workdir)
  const expectedName = `supabase_db_${projectId}`

  try {
    const inspection = await runCommandCapture(
      'docker',
      ['inspect', '-f', '{{.State.Running}}', expectedName],
      workdir,
    )

    if (inspection.stdout.trim() === 'true') {
      return expectedName
    }
  } catch {
    // Fall through to a stricter error.
  }

  throw new Error(
    [
      `Unable to resolve running Supabase DB container for project_id=${projectId}.`,
      `Expected container name: ${expectedName}`,
      `Ensure the local stack is running for workdir ${workdir}.`,
    ].join('\n'),
  )
}

export async function dropLegacyWorktreeDatabaseIfPresent(workdir, databaseName) {
  if (!databaseName.startsWith(LEGACY_WORKTREE_DATABASE_PREFIX)) {
    return false
  }

  let containerName

  try {
    containerName = await resolveSupabaseDbContainerName(workdir)
  } catch {
    return false
  }

  await runCommandCapture(
    'docker',
    [
      'exec',
      containerName,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      `drop database if exists "${databaseName.replaceAll('"', '""')}" with (force)`,
    ],
    workdir,
  )

  return true
}

export async function readSupabaseProjectId(workdir) {
  const configPath = path.join(workdir, 'supabase', 'config.toml')
  const raw = await fsp.readFile(configPath, 'utf8')
  const match = raw.match(/^\s*project_id\s*=\s*"([^"]+)"\s*$/m)

  if (!match) {
    throw new Error(`Unable to read project_id from ${configPath}`)
  }

  return match[1]
}

export async function ensureEnvFileExists(context) {
  if (!(await pathExists(context.envPath))) {
    throw new Error(
      `Missing .env at ${context.envPath}. Run \`pnpm initialize-worktree\` from this worktree first.`,
    )
  }
}

export async function resolveStageScaffold(context) {
  const preferred = path.join(context.mainRepoPath, 'supabase')
  const preferredConfigPath = path.join(preferred, 'config.toml')

  if (await pathExists(preferredConfigPath)) {
    const rawTemplate = await fsp.readFile(preferredConfigPath, 'utf8')

    return {
      sourceSupabaseDir: preferred,
      rawTemplate,
      projectId: buildStageProjectId(context.mainRepoPath),
    }
  }

  const fallback = path.join(context.worktreePath, 'supabase')
  const fallbackConfigPath = path.join(fallback, 'config.toml')

  if (await pathExists(fallbackConfigPath)) {
    const rawTemplate = await fsp.readFile(fallbackConfigPath, 'utf8')
    warn(
      `canonical checkout ${context.mainRepoPath} does not contain supabase/config.toml; adopting current worktree supabase scaffold for shared staging compatibility`,
    )

    return {
      sourceSupabaseDir: fallback,
      rawTemplate,
      projectId: await readSupabaseProjectId(context.worktreePath),
    }
  }

  throw new Error(
    [
      `Unable to resolve a Supabase scaffold for shared staging.`,
      `Missing: ${preferredConfigPath}`,
      `Missing fallback: ${fallbackConfigPath}`,
    ].join('\n'),
  )
}

export async function getGitTopLevel(cwd) {
  const result = await runCommandCapture('git', ['rev-parse', '--show-toplevel'], cwd)
  return result.stdout.trim()
}

export async function getGitCommonDir(cwd) {
  const result = await runCommandCapture('git', ['rev-parse', '--git-common-dir'], cwd)
  const raw = result.stdout.trim()

  if (!raw) {
    throw new Error('Unable to resolve git common dir.')
  }

  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(cwd, raw)
}

export async function getCurrentGitBranch(cwd) {
  const result = await runCommandCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  return result.stdout.trim()
}

export async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath)
    return true
  } catch {
    return false
  }
}

export function requiredStatusValue(map, key) {
  const value = map[key]

  if (!value) {
    throw new Error(`Missing required value from \`supabase status -o env\`: ${key}`)
  }

  return value
}

export function stripEnvValueQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }

  return value
}

export function countOccurrences(content, fragment) {
  let count = 0
  let index = 0

  while (true) {
    const found = content.indexOf(fragment, index)

    if (found < 0) {
      return count
    }

    count += 1
    index = found + fragment.length
  }
}

export function hashString(value, length) {
  return createHash('sha256').update(value).digest('hex').slice(0, length)
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function runCommandCapture(command, args, cwd) {
  try {
    return await execFileAsync(command, args, {
      cwd,
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch (error) {
    const stdout = error?.stdout ?? ''
    const stderr = error?.stderr ?? ''
    const code = error?.code ?? 'unknown'

    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `exit: ${code}`,
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

export function runCommandInherit(command, args, cwd) {
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

export function pipeDockerCommandToFile({ outputPath, command, args }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stream = fs.createWriteStream(outputPath)
    let stderr = ''

    child.stdout.pipe(stream)
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    stream.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          [
            `Command failed while writing dump file: ${command} ${args.join(' ')}`,
            `exit: ${code}`,
            stderr ? `stderr:\n${stderr}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      )
    })
  })
}

export function pipeFileToDockerCommand({ inputPath, command, args }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stream = fs.createReadStream(inputPath)
    let stdout = ''
    let stderr = ''

    stream.pipe(child.stdin)
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    stream.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          [
            `Command failed while restoring dump file: ${command} ${args.join(' ')}`,
            `exit: ${code}`,
            stdout ? `stdout:\n${stdout}` : '',
            stderr ? `stderr:\n${stderr}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      )
    })
  })
}

function log(message) {
  console.log(`[worktree-db] ${message}`)
}

function warn(message) {
  console.warn(`[worktree-db] ${message}`)
}

const entrypointPath = process.argv[1]

if (entrypointPath && import.meta.url === pathToFileURL(path.resolve(entrypointPath)).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[worktree-db] ${message}`)
    process.exit(1)
  })
}

export const worktreeDbScriptPath = fileURLToPath(import.meta.url)
