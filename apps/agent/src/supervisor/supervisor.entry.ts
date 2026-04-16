#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { runAgentMain } from '@agent/app/agent.main'
import { resolveRuntimeExecArgv } from '@agent/runtime/application/supervise-runtime'

export { resolveRuntimeExecArgv }

// Compatibility adapter. Canonical supervisor loop ownership is in @agent/app/agent.main.
export async function runSupervisorMain(): Promise<void> {
  await runAgentMain()
}

export function isSupervisorEntrypoint(entrypoint = process.argv[1]): boolean {
  if (!entrypoint) {
    return false
  }

  const entrypointName = path.basename(entrypoint).toLowerCase()
  return entrypointName === 'supervisor.js' || entrypointName === 'supervisor.ts'
}

export function launchSupervisorMain(): void {
  void runSupervisorMain().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[supervisor] fatal error: ${message}`)
    process.exitCode = 1
  })
}
