#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  AgentControlBackendStateSchema,
  AgentControlBackendUpdateResultSchema,
  AgentControlCommandResultSchema,
  AgentControlLogChannelSchema,
  AgentControlLogsResponseSchema,
  AgentOperationalSnapshotSchema,
} from '@tools/agent/control-core/contracts'
import {
  createAgentControlLocalService,
  readAgentControlBackendState,
} from '@tools/agent/control-core/local-control-service'
import { writeAgentControlPublicBackendState } from '@tools/agent/control-core/public-control-files'
import {
  readAgentControlPublicState,
  writeAgentControlPublicState,
} from '@tools/agent/control-core/public-control-state'
import { EXIT_CONFIG_ERROR, EXIT_FATAL, EXIT_OK } from '@tools/agent/runtime/lifecycle-exit-codes'
import { resolveAgentPublicBackendStatePath, resolveAgentPublicStatePath } from '@tools/agent/runtime/paths'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import { resolveAgentPathLayout } from '@tools/agent/runtime-paths'
import { z } from 'zod/v4'

const adminLogsQuerySchema = z.object({
  channel: AgentControlLogChannelSchema.default('all'),
  tail: z.number().int().min(1).max(2000).default(200),
})

const adminChannelInputSchema = z.object({
  channel: z.string().trim().min(1).nullable(),
})

const adminBlockedVersionsInputSchema = z.object({
  versions: z.array(z.string().trim().min(1)),
})

const adminConfigPatchInputSchema = z.object({
  patch: z.record(z.string(), z.string()),
})

const adminBackendUrlInputSchema = z.object({
  backendUrl: z.string().trim().url(),
})

const adminReleaseVersionInputSchema = z.object({
  version: z.string().trim().min(1),
})

const ctAgentAdminCommands = [
  'get-backend-state',
  'get-logs',
  'start-agent',
  'stop-agent',
  'restart-agent',
  'pause-updates',
  'resume-updates',
  'change-channel',
  'set-blocked-versions',
  'update-config',
  'set-backend-url',
  'activate-release',
  'rollback-release',
  'execute-local-reset',
] as const

type CtAgentAdminCommand = (typeof ctAgentAdminCommands)[number]

export type CtAgentAdminService = ReturnType<typeof createAgentControlLocalService>

type CtAgentAdminDeps = {
  readonly service?: CtAgentAdminService
  readonly print?: (value: string) => void
  readonly printError?: (value: string) => void
}

function isCtAgentAdminCommand(value: string): value is CtAgentAdminCommand {
  return ctAgentAdminCommands.some((command) => command === value)
}

function parseJsonArg(raw: string | undefined): unknown {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {}
  }

  return JSON.parse(raw)
}

function printUsage(print: (value: string) => void): void {
  print(
    ['Usage: ct-agent-admin <command> [json]', `Commands: ${ctAgentAdminCommands.join(', ')}`].join(
      '\n',
    ),
  )
}

function isRunningAsRoot(): boolean {
  if (typeof process.getuid !== 'function') {
    return true
  }

  return process.getuid() === 0
}

async function persistPublicState(service: CtAgentAdminService, snapshot: unknown): Promise<void> {
  const normalizedSnapshot = AgentOperationalSnapshotSchema.parse(snapshot)
  const backendState = readAgentControlBackendState(resolveCtAgentAdminLayout())
  writeAgentControlPublicState({
    filePath: resolveAgentPublicStatePath(),
    snapshot: normalizedSnapshot,
    releaseInventory: service.getReleaseInventory(),
    paths: service.getPaths(),
    backendState,
  })
  writeAgentControlPublicBackendState({
    filePath: resolveAgentPublicBackendStatePath(),
    state: backendState,
  })
}

export function resolveCtAgentAdminLayout(): AgentPathLayout {
  const defaultLayout = resolveAgentPathLayout()
  const publicState = readAgentControlPublicState(resolveAgentPublicStatePath())
  if (!publicState) {
    return defaultLayout
  }

  const dataDir = publicState.paths.dataDir
  return {
    ...defaultLayout,
    dataDir,
    configPath: publicState.paths.configPath,
    baseRuntimeConfigPath: path.join(dataDir, 'control-base.runtime.json'),
    bootstrapPath: path.join(dataDir, 'bootstrap.env'),
    consumedBootstrapPath: path.join(dataDir, 'bootstrap.env.consumed'),
    releasesDir: publicState.paths.releasesDir,
    downloadsDir: path.join(dataDir, 'downloads'),
    logsDir: publicState.paths.logsDir,
    currentLinkPath: path.join(dataDir, 'current'),
    previousLinkPath: path.join(dataDir, 'previous'),
    releaseStatePath: publicState.paths.releaseStatePath,
    runtimeHealthPath: publicState.paths.runtimeHealthPath,
    supervisorControlPath: publicState.paths.supervisorControlPath,
    pendingActivityPath: path.join(dataDir, 'pending-activity-events.json'),
    controlOverridesPath: publicState.paths.controlOverridesPath,
    controlRemoteCachePath: publicState.paths.controlRemoteCachePath,
    infraConfigPath: publicState.paths.infraConfigPath,
    auditLogPath: publicState.paths.auditLogPath,
  }
}

export async function runCtAgentAdmin(command: {
  readonly argv: readonly string[]
  readonly deps?: CtAgentAdminDeps
}): Promise<number> {
  const print = command.deps?.print ?? console.log
  const printError = command.deps?.printError ?? console.error
  const service =
    command.deps?.service ?? createAgentControlLocalService({ layout: resolveCtAgentAdminLayout() })

  const subcommand = command.argv[2]
  if (subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    printUsage(print)
    return EXIT_OK
  }

  if (!subcommand) {
    printUsage(print)
    return EXIT_CONFIG_ERROR
  }

  if (!isCtAgentAdminCommand(subcommand)) {
    printUsage(print)
    printError(`[ct-agent-admin] unknown command: ${subcommand}`)
    return EXIT_CONFIG_ERROR
  }

  try {
    if (subcommand === 'get-backend-state') {
      const result = AgentControlBackendStateSchema.parse(service.getBackendState())
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'get-logs') {
      const query = adminLogsQuerySchema.parse(parseJsonArg(command.argv[3]))
      const result = AgentControlLogsResponseSchema.parse(await service.getLogs(query))
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'start-agent') {
      const result = AgentControlCommandResultSchema.parse(await service.startAgent())
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'stop-agent') {
      const result = AgentControlCommandResultSchema.parse(await service.stopAgent())
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'restart-agent') {
      const result = AgentControlCommandResultSchema.parse(await service.restartAgent())
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'pause-updates') {
      const result = AgentControlCommandResultSchema.parse(await service.pauseUpdates())
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'resume-updates') {
      const result = AgentControlCommandResultSchema.parse(await service.resumeUpdates())
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'change-channel') {
      const input = adminChannelInputSchema.parse(parseJsonArg(command.argv[3]))
      const result = AgentControlCommandResultSchema.parse(
        await service.changeChannel(input.channel),
      )
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'set-blocked-versions') {
      const input = adminBlockedVersionsInputSchema.parse(parseJsonArg(command.argv[3]))
      const result = AgentControlCommandResultSchema.parse(
        await service.setBlockedVersions(input.versions),
      )
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'update-config') {
      const input = adminConfigPatchInputSchema.parse(parseJsonArg(command.argv[3]))
      const result = AgentControlCommandResultSchema.parse(await service.updateConfig(input.patch))
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'activate-release') {
      const input = adminReleaseVersionInputSchema.parse(parseJsonArg(command.argv[3]))
      const result = AgentControlCommandResultSchema.parse(
        await service.activateRelease(input.version),
      )
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'rollback-release') {
      const result = AgentControlCommandResultSchema.parse(await service.rollbackRelease())
      await persistPublicState(service, result.snapshot)
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    if (subcommand === 'set-backend-url') {
      const input = adminBackendUrlInputSchema.parse(parseJsonArg(command.argv[3]))
      const result = AgentControlBackendUpdateResultSchema.parse(
        await service.setBackendUrl(input.backendUrl),
      )
      print(JSON.stringify(result, null, 2))
      return EXIT_OK
    }

    const result = AgentControlCommandResultSchema.parse(await service.executeLocalReset())
    await persistPublicState(service, result.snapshot)
    print(JSON.stringify(result, null, 2))
    return EXIT_OK
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    printError(`[ct-agent-admin] ${message}`)
    return EXIT_FATAL
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    return false
  }

  return path.resolve(entrypoint) === fileURLToPath(import.meta.url)
}

if (isMainModule()) {
  if (isRunningAsRoot()) {
    void runCtAgentAdmin({ argv: process.argv }).then(
      (exitCode) => {
        process.exitCode = exitCode
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[ct-agent-admin] unexpected error: ${message}`)
        process.exitCode = EXIT_FATAL
      },
    )
  } else {
    console.error('[ct-agent-admin] this command must run as root')
    process.exitCode = EXIT_CONFIG_ERROR
  }
}
