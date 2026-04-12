#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const DEFAULT_LOCAL_SUPERUSER = 'supabase_admin'
const DEFAULT_LOCAL_SUPERUSER_PASSWORD = 'postgres'

export const TEMPLATE_DATABASE_NAME = 'ct_template_seeded'
export const ADMIN_DATABASE_NAME = 'postgres'
export const WORKTREE_DATABASE_PREFIX = 'ct_wt_'
export const WORKTREE_METADATA_FILE = '.worktree-db.local.json'
export const WORKTREE_MANAGED_BLOCK_START = '# >>> WORKTREE DB MANAGED BLOCK >>>'
export const WORKTREE_MANAGED_BLOCK_END = '# <<< WORKTREE DB MANAGED BLOCK <<<'
const TEMPLATE_LOCK_FILE_NAME = 'ct-template-db.lock'

async function main() {
  const command = process.argv[2]

  if (!command) {
    printUsage()
    process.exit(1)
  }

  switch (command) {
    case 'local-stack-ensure':
      await commandLocalStackEnsure(process.cwd())
      return
    case 'template-ensure':
      await commandTemplateEnsure(process.cwd())
      return
    case 'template-refresh':
      await commandTemplateRefresh(process.cwd())
      return
    case 'worktree-init':
      await commandWorktreeInit(process.cwd())
      return
    case 'worktree-reset':
      await commandWorktreeReset(process.cwd())
      return
    case 'worktree-status':
      await commandWorktreeStatus(process.cwd())
      return
    case 'worktree-drop':
      await commandWorktreeDrop(process.cwd())
      return
    default:
      printUsage()
      throw new Error(`Unsupported command: ${command}`)
  }
}

function printUsage() {
  log('usage: node scripts/db/worktree-db.mjs <command>')
  log(
    'commands: local-stack-ensure | template-ensure | template-refresh | worktree-init | worktree-reset | worktree-status | worktree-drop',
  )
}

export async function commandLocalStackEnsure(cwd) {
  const stack = await ensureLocalStack(cwd)
  log(`local stack ready: ${stack.dbUrl}`)
}

export async function commandTemplateEnsure(cwd) {
  const stack = await ensureLocalStack(cwd)
  const result = await ensureTemplateDatabase({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    stackDbUrl: stack.dbUrl,
  })

  log(`template database ${result.action}: ${TEMPLATE_DATABASE_NAME}`)
}

export async function commandTemplateRefresh(cwd) {
  const stack = await ensureLocalStack(cwd)
  const result = await refreshTemplateDatabase({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    stackDbUrl: stack.dbUrl,
  })

  log(`template database ${result.action}: ${TEMPLATE_DATABASE_NAME}`)
}

export async function commandWorktreeInit(cwd) {
  const context = await getWorktreeContext(cwd)
  const stack = await ensureLocalStack(cwd)

  await ensureTemplateDatabase({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    stackDbUrl: stack.dbUrl,
  })

  const exists = await databaseExists({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    databaseName: context.databaseName,
  })

  let action = 'reused'
  if (!exists) {
    await createDatabase({
      cwd,
      adminDbUrl: stack.adminDbUrl,
      databaseName: context.databaseName,
      templateDatabaseName: TEMPLATE_DATABASE_NAME,
    })
    action = 'created'
  }

  const databaseUrl = withDatabaseName(stack.dbUrl, context.databaseName)

  await updateWorktreeEnvFile({
    envPath: context.envPath,
    databaseName: context.databaseName,
    databaseUrl,
  })

  await writeWorktreeMetadata({
    metadataPath: context.metadataPath,
    payload: {
      version: 1,
      generatedAt: new Date().toISOString(),
      worktreePath: context.worktreePath,
      worktreeName: context.worktreeName,
      gitBranch: context.gitBranch,
      templateDatabaseName: TEMPLATE_DATABASE_NAME,
      databaseName: context.databaseName,
      databaseUrl,
    },
  })

  log(`worktree database ${action}: ${context.databaseName}`)
}

export async function commandWorktreeReset(cwd) {
  const context = await getWorktreeContext(cwd)
  const stack = await ensureLocalStack(cwd)

  await ensureTemplateDatabase({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    stackDbUrl: stack.dbUrl,
  })

  const exists = await databaseExists({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    databaseName: context.databaseName,
  })

  if (exists) {
    await dropDatabase({
      cwd,
      adminDbUrl: stack.adminDbUrl,
      databaseName: context.databaseName,
    })
  }

  await createDatabase({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    databaseName: context.databaseName,
    templateDatabaseName: TEMPLATE_DATABASE_NAME,
  })

  const databaseUrl = withDatabaseName(stack.dbUrl, context.databaseName)
  await updateWorktreeEnvFile({
    envPath: context.envPath,
    databaseName: context.databaseName,
    databaseUrl,
  })

  await writeWorktreeMetadata({
    metadataPath: context.metadataPath,
    payload: {
      version: 1,
      generatedAt: new Date().toISOString(),
      worktreePath: context.worktreePath,
      worktreeName: context.worktreeName,
      gitBranch: context.gitBranch,
      templateDatabaseName: TEMPLATE_DATABASE_NAME,
      databaseName: context.databaseName,
      databaseUrl,
    },
  })

  log(`worktree database reset from template: ${context.databaseName}`)
}

export async function commandWorktreeStatus(cwd) {
  const context = await getWorktreeContext(cwd)
  const stack = await ensureLocalStack(cwd)
  const databaseUrl = withDatabaseName(stack.dbUrl, context.databaseName)
  const exists = await databaseExists({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    databaseName: context.databaseName,
  })

  console.log(
    JSON.stringify(
      {
        worktreePath: context.worktreePath,
        worktreeName: context.worktreeName,
        gitBranch: context.gitBranch,
        databaseName: context.databaseName,
        databaseUrl,
        templateDatabaseName: TEMPLATE_DATABASE_NAME,
        exists,
      },
      null,
      2,
    ),
  )
}

export async function commandWorktreeDrop(cwd) {
  const context = await getWorktreeContext(cwd)
  assertWorktreeDatabaseName(context.databaseName)

  const stack = await ensureLocalStack(cwd)
  const exists = await databaseExists({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    databaseName: context.databaseName,
  })

  if (!exists) {
    log(`worktree database not found (nothing to drop): ${context.databaseName}`)
    return
  }

  await dropDatabase({
    cwd,
    adminDbUrl: stack.adminDbUrl,
    databaseName: context.databaseName,
  })

  await fs.rm(context.metadataPath, { force: true })

  log(`worktree database dropped: ${context.databaseName}`)
  warn('Run `pnpm db:worktree:init` to recreate and re-seed the local DB for this worktree.')
}

export async function getWorktreeContext(cwd) {
  const worktreePath = path.resolve(cwd)
  const worktreeName = path.basename(worktreePath)
  const gitBranch = await getCurrentGitBranch(worktreePath)

  return {
    worktreePath,
    worktreeName,
    gitBranch,
    databaseName: buildWorktreeDatabaseName(worktreePath),
    envPath: path.join(worktreePath, '.env'),
    metadataPath: path.join(worktreePath, WORKTREE_METADATA_FILE),
  }
}

export async function ensureLocalStack(cwd) {
  try {
    const envMap = await getSupabaseStatusEnvMap(cwd)
    return {
      envMap,
      dbUrl: requiredEnvValue(envMap, 'DB_URL'),
      adminDbUrl: withDatabaseName(requiredEnvValue(envMap, 'DB_URL'), ADMIN_DATABASE_NAME),
    }
  } catch {
    log('supabase local stack is not running; starting stack once for this machine...')
    await runCommandInherit('npx', ['supabase', 'start'], cwd)

    const envMap = await getSupabaseStatusEnvMap(cwd)
    return {
      envMap,
      dbUrl: requiredEnvValue(envMap, 'DB_URL'),
      adminDbUrl: withDatabaseName(requiredEnvValue(envMap, 'DB_URL'), ADMIN_DATABASE_NAME),
    }
  }
}

export function ensureTemplateDatabase({ cwd, adminDbUrl }) {
  return withTemplateLock(cwd, async () => {
    const exists = await databaseExists({
      cwd,
      adminDbUrl,
      databaseName: TEMPLATE_DATABASE_NAME,
    })

    if (exists) {
      const valid = await isTemplateDatabaseUsable({ cwd })
      if (valid) {
        return { action: 'reused' }
      }

      warn(
        'template database exists but is not bootstrapped; rebuilding from current postgres state.',
      )
      await dropTemplateDatabase({ cwd })
    }

    await createDatabase({
      cwd,
      adminDbUrl,
      databaseName: TEMPLATE_DATABASE_NAME,
      templateDatabaseName: null,
    })

    await clonePostgresIntoDatabase({
      cwd,
      targetDatabaseName: TEMPLATE_DATABASE_NAME,
    })

    return { action: 'created' }
  })
}

export function refreshTemplateDatabase({ cwd, adminDbUrl }) {
  return withTemplateLock(cwd, async () => {
    warn(
      'template refresh rebuilds template from canonical local reset (this can restart local services and invalidate stale local DB states).',
    )
    await runCommandInherit('npx', ['supabase', 'db', 'reset', '--yes'], cwd)

    if (
      await databaseExists({
        cwd,
        databaseName: TEMPLATE_DATABASE_NAME,
      })
    ) {
      await dropTemplateDatabase({
        cwd,
      })
    }

    await createDatabase({
      cwd,
      adminDbUrl,
      databaseName: TEMPLATE_DATABASE_NAME,
      templateDatabaseName: null,
    })

    await clonePostgresIntoDatabase({
      cwd,
      targetDatabaseName: TEMPLATE_DATABASE_NAME,
    })

    return { action: 'refreshed' }
  })
}

export async function databaseExists({ cwd, databaseName }) {
  const containerName = await resolveSupabaseDbContainerName(cwd)
  const { superuser, password } = getLocalDbAdminCredentials()
  const result = await runCommandCapture(
    'docker',
    [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'psql',
      '-h',
      'localhost',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      superuser,
      '-d',
      ADMIN_DATABASE_NAME,
      '-tAc',
      `select 1 from pg_database where datname = ${sqlLiteral(databaseName)} limit 1`,
    ],
    cwd,
  )

  return result.stdout.trim() === '1'
}

export async function createDatabase({ cwd, databaseName, templateDatabaseName }) {
  const containerName = await resolveSupabaseDbContainerName(cwd)
  const { superuser, password } = getLocalDbAdminCredentials()
  const templateClause = templateDatabaseName
    ? ` template ${sqlIdentifier(templateDatabaseName)}`
    : ''

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
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      superuser,
      '-d',
      ADMIN_DATABASE_NAME,
      '-c',
      `create database ${sqlIdentifier(databaseName)}${templateClause}`,
    ],
    cwd,
  )
}

export async function dropDatabase({ cwd, databaseName }) {
  assertDropAllowedDatabaseName(databaseName)
  const containerName = await resolveSupabaseDbContainerName(cwd)
  const { superuser, password } = getLocalDbAdminCredentials()

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
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      superuser,
      '-d',
      ADMIN_DATABASE_NAME,
      '-c',
      `drop database if exists ${sqlIdentifier(databaseName)} with (force)`,
    ],
    cwd,
  )
}

export async function dropTemplateDatabase({ cwd }) {
  const containerName = await resolveSupabaseDbContainerName(cwd)
  const { superuser, password } = getLocalDbAdminCredentials()

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
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      superuser,
      '-d',
      ADMIN_DATABASE_NAME,
      '-c',
      `drop database if exists ${sqlIdentifier(TEMPLATE_DATABASE_NAME)} with (force)`,
    ],
    cwd,
  )
}

export async function isTemplateDatabaseUsable({ cwd }) {
  const containerName = await resolveSupabaseDbContainerName(cwd)
  const { superuser, password } = getLocalDbAdminCredentials()
  const result = await runCommandCapture(
    'docker',
    [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'psql',
      '-h',
      'localhost',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      superuser,
      '-d',
      TEMPLATE_DATABASE_NAME,
      '-tAc',
      "select (to_regclass('public.processes') is not null and to_regclass('public.containers') is not null and to_regclass('public.container_observations') is not null)::int",
    ],
    cwd,
  )

  return result.stdout.trim() === '1'
}

export async function updateWorktreeEnvFile({ envPath, databaseName, databaseUrl }) {
  const envExists = await pathExists(envPath)

  if (!envExists) {
    throw new Error(
      `Missing .env at ${envPath}. Run initialize-worktree first (it copies .env before DB provisioning).`,
    )
  }

  const current = await fs.readFile(envPath, 'utf8')
  const updated = upsertManagedDbEnvBlock(current, { databaseName, databaseUrl })

  if (updated === current) {
    log('.env already up to date with managed worktree DB block')
    return
  }

  await fs.writeFile(envPath, updated)
  log(`updated managed DB block in ${envPath}`)
}

export async function writeWorktreeMetadata({ metadataPath, payload }) {
  await fs.writeFile(metadataPath, `${JSON.stringify(payload, null, 2)}\n`)
  log(`wrote metadata: ${metadataPath}`)
}

export function upsertManagedDbEnvBlock(content, { databaseName, databaseUrl }) {
  const replacement = renderManagedDbEnvBlock({ databaseName, databaseUrl })
  const startCount = countOccurrences(content, WORKTREE_MANAGED_BLOCK_START)
  const endCount = countOccurrences(content, WORKTREE_MANAGED_BLOCK_END)

  if (startCount !== endCount) {
    throw new Error('Managed DB block markers are unbalanced in .env.')
  }

  if (startCount > 1) {
    throw new Error('Managed DB block appears multiple times in .env.')
  }

  if (startCount === 0) {
    const normalized = content.endsWith('\n') ? content : `${content}\n`
    return `${normalized}\n${replacement}\n`
  }

  const startIndex = content.indexOf(WORKTREE_MANAGED_BLOCK_START)
  const endIndex = content.indexOf(WORKTREE_MANAGED_BLOCK_END)

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error('Unable to replace managed DB block in .env due to invalid marker order.')
  }

  const endMarkerEndIndex = endIndex + WORKTREE_MANAGED_BLOCK_END.length
  const before = content.slice(0, startIndex)
  const after = content.slice(endMarkerEndIndex)

  return `${before}${replacement}${after}`
}

export function renderManagedDbEnvBlock({ databaseName, databaseUrl }) {
  return [
    WORKTREE_MANAGED_BLOCK_START,
    '# This block is auto-generated by `pnpm db:worktree:init`.',
    '# Do not edit manually. Re-run the command to refresh values.',
    `POSTGRES_DATABASE="${databaseName}"`,
    `POSTGRES_PRISMA_URL="${databaseUrl}"`,
    `POSTGRES_URL="${databaseUrl}"`,
    `POSTGRES_URL_NON_POOLING="${databaseUrl}"`,
    `LOCAL_DB_URL=${databaseUrl}`,
    WORKTREE_MANAGED_BLOCK_END,
  ].join('\n')
}

export function buildWorktreeDatabaseName(worktreePath) {
  const prefix = WORKTREE_DATABASE_PREFIX
  const hashSuffix = `_${hashString(path.resolve(worktreePath), 8)}`
  const maxSlugLength = 63 - prefix.length - hashSuffix.length

  if (maxSlugLength < 1) {
    throw new Error('Invalid DB name constraints while computing worktree DB name.')
  }

  const sanitized = sanitizeIdentifierSegment(path.basename(worktreePath)) || 'worktree'
  const slug = sanitized.slice(0, maxSlugLength).replace(/_+$/g, '') || 'worktree'

  return `${prefix}${slug}${hashSuffix}`
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

export function withDatabaseName(dbUrl, databaseName) {
  const parsed = new URL(dbUrl)
  parsed.pathname = `/${databaseName}`
  return parsed.toString()
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

    const key = match[1]
    const rawValue = match[2].trim()
    envMap[key] = stripEnvValueQuotes(rawValue)
  }

  return envMap
}

export function extractJsonFromText(text) {
  const lines = text.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trimStart()

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      continue
    }

    const candidate = lines.slice(index).join('\n')

    try {
      return JSON.parse(candidate)
    } catch {
      // Continue searching for a valid JSON start.
    }
  }

  throw new Error('Unable to parse JSON from command output.')
}

export async function clonePostgresIntoDatabase({ cwd, targetDatabaseName }) {
  const containerName = await resolveSupabaseDbContainerName(cwd)
  const { superuser, password } = getLocalDbAdminCredentials()
  const escapedPassword = shellEscape(password)
  const escapedSuperuser = shellEscape(superuser)
  const escapedTargetDatabaseName = shellEscape(targetDatabaseName)

  const dumpAndRestoreCommand = [
    `docker exec -e PGPASSWORD=${escapedPassword} ${containerName} pg_dump -h localhost -U ${escapedSuperuser} -d postgres -Fc --no-owner --no-privileges --exclude-extension=pg_cron`,
    `docker exec -i -e PGPASSWORD=${escapedPassword} ${containerName} pg_restore -h localhost -U ${escapedSuperuser} -d ${escapedTargetDatabaseName} --no-owner --no-privileges`,
  ].join(' | ')

  await runShellCommandInherit(dumpAndRestoreCommand, cwd)
}

export async function resolveSupabaseDbContainerName(cwd) {
  const projectId = await readSupabaseProjectId(cwd)
  const expectedName = `supabase_db_${projectId}`

  try {
    const inspection = await runCommandCapture(
      'docker',
      ['inspect', '-f', '{{.State.Running}}', expectedName],
      cwd,
    )

    if (inspection.stdout.trim() === 'true') {
      return expectedName
    }
  } catch {
    // Fallback below.
  }

  const listing = await runCommandCapture('docker', ['ps', '--format', '{{.Names}}'], cwd)
  const runningDbContainers = listing.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('supabase_db_'))

  if (runningDbContainers.includes(expectedName)) {
    return expectedName
  }

  if (runningDbContainers.length === 1) {
    return runningDbContainers[0]
  }

  throw new Error(
    [
      `Unable to resolve running Supabase DB container for project_id=${projectId}.`,
      `Expected container name: ${expectedName}`,
      'Ensure local stack is running: pnpm supabase:start',
    ].join('\n'),
  )
}

export async function readSupabaseProjectId(cwd) {
  const configPath = path.join(cwd, 'supabase', 'config.toml')
  const raw = await fs.readFile(configPath, 'utf8')
  const match = raw.match(/^\s*project_id\s*=\s*"([^"]+)"\s*$/m)

  if (!match) {
    throw new Error(`Unable to read project_id from ${configPath}`)
  }

  return match[1]
}

export async function getSupabaseStatusEnvMap(cwd) {
  const result = await runCommandCapture('npx', ['supabase', 'status', '-o', 'env'], cwd)
  const envMap = parseSupabaseStatusEnvOutput(result.stdout)

  if (!envMap.DB_URL) {
    throw new Error('Supabase status did not include DB_URL.')
  }

  return envMap
}

export async function getCurrentGitBranch(cwd) {
  const result = await runCommandCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
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

export async function withTemplateLock(cwd, operation) {
  const gitCommonDir = await getGitCommonDir(cwd)
  const lockPath = path.join(gitCommonDir, TEMPLATE_LOCK_FILE_NAME)
  const timeoutMs = 120_000
  const pollMs = 1000
  const startedAt = Date.now()

  let lockHandle = null
  let waited = false

  while (!lockHandle) {
    try {
      lockHandle = await fs.open(lockPath, 'wx')
      await lockHandle.writeFile(`${process.pid} ${new Date().toISOString()}\n`)
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'EEXIST') {
        if (!waited) {
          log(`waiting for shared template lock at ${lockPath}`)
          waited = true
        }

        if (Date.now() - startedAt > timeoutMs) {
          throw new Error(`Timed out waiting for template lock: ${lockPath}`)
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
    await lockHandle.close()
    await fs.rm(lockPath, { force: true })
  }
}

export function assertWorktreeDatabaseName(databaseName) {
  if (!databaseName.startsWith(WORKTREE_DATABASE_PREFIX)) {
    throw new Error(
      `Refusing operation on non-worktree database "${databaseName}". Expected prefix ${WORKTREE_DATABASE_PREFIX}.`,
    )
  }
}

export function assertDropAllowedDatabaseName(databaseName) {
  const protectedNames = new Set([
    ADMIN_DATABASE_NAME,
    TEMPLATE_DATABASE_NAME,
    'template0',
    'template1',
    '_supabase',
  ])

  if (protectedNames.has(databaseName)) {
    throw new Error(`Refusing to drop protected database: ${databaseName}`)
  }

  assertWorktreeDatabaseName(databaseName)
}

export function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`
}

export function sqlIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function stripEnvValueQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }

  return value
}

function requiredEnvValue(map, key) {
  const value = map[key]
  if (!value) {
    throw new Error(`Missing required env key from supabase status: ${key}`)
  }

  return value
}

function countOccurrences(content, fragment) {
  if (!fragment) {
    return 0
  }

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

function hashString(value, length) {
  return createHash('sha256').update(value).digest('hex').slice(0, length)
}

export function getLocalDbAdminCredentials() {
  return {
    superuser: process.env.SUPABASE_LOCAL_DB_SUPERUSER ?? DEFAULT_LOCAL_SUPERUSER,
    password:
      process.env.SUPABASE_LOCAL_DB_SUPERUSER_PASSWORD ??
      process.env.SUPABASE_DB_PASSWORD ??
      DEFAULT_LOCAL_SUPERUSER_PASSWORD,
  }
}

function shellEscape(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
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

export function runPsqlWithSqlInput({ cwd, containerName, databaseName, sqlContent, sourceLabel }) {
  return new Promise((resolve, reject) => {
    const args = [
      'exec',
      '-i',
      containerName,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      databaseName,
    ]

    const child = spawn('docker', args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          [
            `Failed to execute SQL input with docker psql (exit=${code}).`,
            sourceLabel ? `source: ${sourceLabel}` : '',
            stdout ? `stdout:\n${stdout}` : '',
            stderr ? `stderr:\n${stderr}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      )
    })

    child.stdin.write(sqlContent)
    child.stdin.end()
  })
}

export function runShellCommandInherit(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: process.env,
      stdio: 'inherit',
      shell: true,
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
