#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'

import { resolveAgentPathLayout } from '@agent/runtime-paths'
import { createUpdaterPublicLogsPublisher, runUpdaterMain } from '@agent/updater/updater.entry'

export { createUpdaterPublicLogsPublisher }

function ensureDotenvPath(): void {
  const currentDotenvPath = process.env.DOTENV_PATH?.trim()
  if (currentDotenvPath && currentDotenvPath.length > 0) {
    return
  }

  process.env.DOTENV_PATH = resolveAgentPathLayout().configPath
}

function isUpdaterEntrypoint(): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    return false
  }

  const entrypointName = path.basename(entrypoint).toLowerCase()
  return entrypointName === 'updater.js' || entrypointName === 'updater.ts'
}

if (isUpdaterEntrypoint()) {
  ensureDotenvPath()
  void runUpdaterMain()
}
