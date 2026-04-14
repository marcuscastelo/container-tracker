#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  loadRawAgentEnvFromFile,
  parseAgentConfig,
  parseBootstrapConfig,
  serializeAgentConfig,
  serializeBootstrapConfig,
  validateAgentConfig,
} from '@agent/config/agent-config.mapper'
import {
  type ValidatedAgentConfig,
  ValidatedAgentConfigSchema,
  type ValidatedBootstrapConfig,
} from '@agent/core/contracts/agent-config.contract'
import { writeFileAtomic } from '@agent/state/file-io'
import { toReleaseState } from '@agent/state/release-state.mapper'
import { z } from 'zod/v4'

// biome-ignore lint/style/noRestrictedImports: CLI runtime resolves direct .ts imports for bundled agent execution.
import { EXIT_CONFIG_ERROR, EXIT_FATAL, EXIT_OK } from '../runtime/lifecycle-exit-codes.ts'
// biome-ignore lint/style/noRestrictedImports: CLI runtime resolves direct .ts imports for bundled agent execution.
import { readRuntimeHealth } from '../runtime-health.ts'
// biome-ignore lint/style/noRestrictedImports: CLI runtime resolves direct .ts imports for bundled agent execution.
import { resolveAgentPathLayout } from '../runtime-paths.ts'

const AGENT_SERVICE_NAME = 'container-tracker-agent'
const JOURNAL_TAIL_LINES = '200'
type RuntimeConfig = ValidatedAgentConfig
type BootstrapConfig = ValidatedBootstrapConfig

const enrollResponseSchema = z.object({
  agentToken: z.string().min(1),
  tenantId: z.string().uuid(),
  intervalSec: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
  providers: z.object({
    maerskEnabled: z.boolean(),
    maerskHeadless: z.boolean(),
    maerskTimeoutMs: z.number().int().positive(),
    maerskUserDataDir: z.string().min(1).optional(),
  }),
})

type EnrollResponse = z.infer<typeof enrollResponseSchema>

type CommandRunner = (command: string, args: readonly string[]) => Promise<number>

type CtAgentDeps = {
  readonly runCommand: CommandRunner
  readonly fetchImpl: typeof fetch
}

const ctAgentCommands = ['status', 'logs', 'restart', 'update-status', 'enroll'] as const
type CtAgentCommand = (typeof ctAgentCommands)[number]

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

function parseRuntimeConfigFromFile(filePath: string): RuntimeConfig | null {
  const raw = loadRawAgentEnvFromFile(filePath)
  if (!raw) {
    return null
  }

  try {
    const parsed = parseAgentConfig(raw)
    return validateAgentConfig(parsed)
  } catch {
    return null
  }
}

function parseBootstrapConfigFromFile(filePath: string): {
  readonly config: BootstrapConfig
  readonly raw: string
} | null {
  const raw = loadRawAgentEnvFromFile(filePath)
  if (!raw) {
    return null
  }

  const parsed = parseAgentConfig(raw)
  return {
    config: parseBootstrapConfig(parsed),
    raw: raw.raw,
  }
}

function resolveMachineFingerprint(hostname: string): string {
  const providedMachineGuid = normalizeOptionalEnv(process.env.AGENT_MACHINE_GUID)
  const machineGuid = providedMachineGuid ?? hostname
  return createHash('sha256').update(`${machineGuid}|${hostname}`, 'utf8').digest('hex')
}

function resolveAgentVersion(scriptDir: string): string {
  const candidatePaths = [
    path.resolve(scriptDir, '../../package.json'),
    path.resolve(scriptDir, '../../../package.json'),
    path.resolve(scriptDir, '../../../../package.json'),
  ]

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) {
      continue
    }

    try {
      const raw = fs.readFileSync(candidatePath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'version' in parsed &&
        typeof parsed.version === 'string' &&
        parsed.version.trim().length > 0
      ) {
        return parsed.version.trim()
      }
    } catch {
      // continue fallback chain
    }
  }

  return 'unknown'
}

async function enrollRuntime(command: {
  readonly bootstrapConfig: BootstrapConfig
  readonly machineFingerprint: string
  readonly hostname: string
  readonly osName: string
  readonly agentVersion: string
  readonly fetchImpl: typeof fetch
}): Promise<EnrollResponse> {
  const response = await command.fetchImpl(
    `${command.bootstrapConfig.BACKEND_URL}/api/agent/enroll`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${command.bootstrapConfig.INSTALLER_TOKEN}`,
        'content-type': 'application/json',
        'x-agent-id': command.bootstrapConfig.AGENT_ID,
        'user-agent': `container-tracker-agent/${command.bootstrapConfig.AGENT_ID}`,
      },
      body: JSON.stringify({
        machineFingerprint: command.machineFingerprint,
        hostname: command.hostname,
        os: command.osName,
        agentVersion: command.agentVersion,
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`enroll request failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = enrollResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid enroll response: ${parsed.error.message}`)
  }

  return parsed.data
}

function toRuntimeConfig(command: {
  readonly bootstrapConfig: BootstrapConfig
  readonly enrollResponse: EnrollResponse
}): RuntimeConfig {
  return ValidatedAgentConfigSchema.parse({
    BACKEND_URL: command.bootstrapConfig.BACKEND_URL,
    SUPABASE_URL: command.enrollResponse.supabaseUrl ?? null,
    SUPABASE_ANON_KEY: command.enrollResponse.supabaseAnonKey ?? null,
    AGENT_TOKEN: command.enrollResponse.agentToken,
    TENANT_ID: command.enrollResponse.tenantId,
    AGENT_ID: command.bootstrapConfig.AGENT_ID,
    INTERVAL_SEC: command.enrollResponse.intervalSec,
    LIMIT: command.enrollResponse.limit,
    MAERSK_ENABLED: command.enrollResponse.providers.maerskEnabled,
    MAERSK_HEADLESS: command.enrollResponse.providers.maerskHeadless,
    MAERSK_TIMEOUT_MS: command.enrollResponse.providers.maerskTimeoutMs,
    MAERSK_USER_DATA_DIR: command.enrollResponse.providers.maerskUserDataDir ?? null,
    AGENT_UPDATE_MANIFEST_CHANNEL: command.bootstrapConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
  })
}

function sanitizeText(value: string, secrets: readonly string[]): string {
  let sanitized = value
  for (const secret of secrets) {
    if (secret.length === 0) continue
    sanitized = sanitized.split(secret).join('[REDACTED]')
  }
  return sanitized
}

function toErrorMessage(error: unknown, secrets: readonly string[] = []): string {
  if (error instanceof Error) {
    return sanitizeText(error.message, secrets)
  }

  return sanitizeText(String(error), secrets)
}

function persistConfigFile(configPath: string, config: RuntimeConfig): void {
  writeFileAtomic(configPath, serializeAgentConfig(config))
}

function consumeBootstrapFile(command: {
  readonly bootstrapPath: string
  readonly consumedBootstrapPath: string
  readonly bootstrapConfig: BootstrapConfig
  readonly bootstrapRaw: string
}): void {
  const consumedContent = sanitizeText(command.bootstrapRaw, [
    command.bootstrapConfig.INSTALLER_TOKEN,
  ])
  const safeContent =
    consumedContent === command.bootstrapRaw
      ? serializeBootstrapConfig({
          config: command.bootstrapConfig,
          redactInstallerToken: true,
        })
      : consumedContent

  writeFileAtomic(command.consumedBootstrapPath, safeContent)
  fs.rmSync(command.bootstrapPath, { force: true })
}

function printUsage(): void {
  console.log('Usage: ct-agent <status|logs|restart|update-status|enroll>')
}

function isCtAgentCommand(value: string): value is CtAgentCommand {
  return ctAgentCommands.some((command) => command === value)
}

function createDefaultCommandRunner(): CommandRunner {
  return async (command, args) =>
    await new Promise<number>((resolve, reject) => {
      const child = spawn(command, [...args], {
        stdio: 'inherit',
        shell: false,
      })

      child.once('error', reject)
      child.once('exit', (code) => {
        resolve(code ?? EXIT_FATAL)
      })
    })
}

async function runStatusCommand(): Promise<number> {
  const layout = resolveAgentPathLayout()
  const status = readRuntimeHealth(layout.runtimeHealthPath)
  if (!status) {
    console.error(`[ct-agent] runtime health unavailable at ${layout.runtimeHealthPath}`)
    return EXIT_FATAL
  }

  console.log(JSON.stringify(status, null, 2))
  return EXIT_OK
}

async function runLogsCommand(runCommand: CommandRunner): Promise<number> {
  const journalArgs = [
    '-u',
    AGENT_SERVICE_NAME,
    '-n',
    JOURNAL_TAIL_LINES,
    '-f',
    '--no-pager',
  ] as const
  try {
    const journalExitCode = await runCommand('journalctl', journalArgs)
    if (journalExitCode === EXIT_OK) {
      return EXIT_OK
    }

    console.warn(
      `[ct-agent] journalctl exited with code ${journalExitCode}; falling back to local logs`,
    )
  } catch (error) {
    console.warn(`[ct-agent] journalctl unavailable: ${toErrorMessage(error)}`)
  }

  const layout = resolveAgentPathLayout()
  const outLogPath = path.join(layout.logsDir, 'agent.out.log')
  const errLogPath = path.join(layout.logsDir, 'agent.err.log')
  const localLogs = [outLogPath, errLogPath].filter((candidate) => fs.existsSync(candidate))

  if (localLogs.length === 0) {
    const fallbackLogPath = path.join(layout.logsDir, 'supervisor.log')
    if (fs.existsSync(fallbackLogPath)) {
      localLogs.push(fallbackLogPath)
    }
  }

  if (localLogs.length === 0) {
    console.error(
      `[ct-agent] local log files not found: ${outLogPath}, ${errLogPath}, supervisor.log`,
    )
    return EXIT_FATAL
  }

  try {
    const tailExitCode = await runCommand('tail', ['-n', JOURNAL_TAIL_LINES, '-F', ...localLogs])
    return tailExitCode === EXIT_OK ? EXIT_OK : EXIT_FATAL
  } catch (error) {
    console.error(`[ct-agent] could not stream local logs: ${toErrorMessage(error)}`)
    return EXIT_FATAL
  }
}

async function runRestartCommand(runCommand: CommandRunner): Promise<number> {
  try {
    const exitCode = await runCommand('systemctl', ['restart', AGENT_SERVICE_NAME])
    return exitCode === EXIT_OK ? EXIT_OK : EXIT_FATAL
  } catch (error) {
    console.error(`[ct-agent] restart failed: ${toErrorMessage(error)}`)
    return EXIT_FATAL
  }
}

async function runUpdateStatusCommand(): Promise<number> {
  const layout = resolveAgentPathLayout()
  if (!fs.existsSync(layout.releaseStatePath)) {
    console.error(`[ct-agent] release state not found at ${layout.releaseStatePath}`)
    return EXIT_FATAL
  }

  try {
    const raw = fs.readFileSync(layout.releaseStatePath, 'utf8')
    const parsed = toReleaseState(JSON.parse(raw))
    console.log(JSON.stringify(parsed, null, 2))
    return EXIT_OK
  } catch (error) {
    console.error(`[ct-agent] invalid release state: ${toErrorMessage(error)}`)
    return EXIT_CONFIG_ERROR
  }
}

async function runEnrollCommand(fetchImpl: typeof fetch): Promise<number> {
  const layout = resolveAgentPathLayout()
  const existingConfig = parseRuntimeConfigFromFile(layout.configPath)
  if (existingConfig) {
    console.log(
      `[ct-agent] already enrolled (tenant=${existingConfig.TENANT_ID}, agent=${existingConfig.AGENT_ID})`,
    )
    return EXIT_OK
  }

  let bootstrapLoaded: { readonly config: BootstrapConfig; readonly raw: string } | null = null
  try {
    bootstrapLoaded = parseBootstrapConfigFromFile(layout.bootstrapPath)
    if (!bootstrapLoaded) {
      console.error(`[ct-agent] bootstrap.env not found at ${layout.bootstrapPath}`)
      return EXIT_CONFIG_ERROR
    }
  } catch (error) {
    console.error(`[ct-agent] bootstrap configuration error: ${toErrorMessage(error)}`)
    return EXIT_CONFIG_ERROR
  }

  const secrets = [bootstrapLoaded.config.INSTALLER_TOKEN]
  const hostname = os.hostname()
  const machineFingerprint = resolveMachineFingerprint(hostname)
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const agentVersion = resolveAgentVersion(scriptDir)

  try {
    const enrollResponse = await enrollRuntime({
      bootstrapConfig: bootstrapLoaded.config,
      machineFingerprint,
      hostname,
      osName: `${os.platform()} ${os.release()}`,
      agentVersion,
      fetchImpl,
    })

    const runtimeConfig = toRuntimeConfig({
      bootstrapConfig: bootstrapLoaded.config,
      enrollResponse,
    })

    persistConfigFile(layout.configPath, runtimeConfig)
    consumeBootstrapFile({
      bootstrapPath: layout.bootstrapPath,
      consumedBootstrapPath: layout.consumedBootstrapPath,
      bootstrapConfig: bootstrapLoaded.config,
      bootstrapRaw: bootstrapLoaded.raw,
    })

    console.log(
      `[ct-agent] enroll successful (tenant=${runtimeConfig.TENANT_ID}, agent=${runtimeConfig.AGENT_ID})`,
    )
    return EXIT_OK
  } catch (error) {
    console.error(`[ct-agent] enroll failed: ${toErrorMessage(error, secrets)}`)
    return EXIT_FATAL
  }
}

export async function runCtAgent(command: {
  readonly argv: readonly string[]
  readonly deps?: Partial<CtAgentDeps>
}): Promise<number> {
  const runCommand = command.deps?.runCommand ?? createDefaultCommandRunner()
  const fetchImpl = command.deps?.fetchImpl ?? fetch

  const subcommand = command.argv[2]
  if (subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    printUsage()
    return EXIT_OK
  }

  if (!subcommand) {
    printUsage()
    return EXIT_CONFIG_ERROR
  }

  if (!isCtAgentCommand(subcommand)) {
    printUsage()
    console.error(`[ct-agent] unknown command: ${subcommand}`)
    return EXIT_CONFIG_ERROR
  }

  if (subcommand === 'status') {
    return await runStatusCommand()
  }

  if (subcommand === 'logs') {
    return await runLogsCommand(runCommand)
  }

  if (subcommand === 'restart') {
    return await runRestartCommand(runCommand)
  }

  if (subcommand === 'update-status') {
    return await runUpdateStatusCommand()
  }

  return await runEnrollCommand(fetchImpl)
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    return false
  }

  try {
    return path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isMainModule()) {
  void runCtAgent({ argv: process.argv }).then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error: unknown) => {
      console.error(`[ct-agent] unexpected error: ${toErrorMessage(error)}`)
      process.exitCode = EXIT_FATAL
    },
  )
}
