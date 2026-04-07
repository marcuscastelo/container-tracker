#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'

import {
  createUpdaterPublicLogsPublisher,
  runUpdaterMain,
} from './updater/updater.entry.ts'

export { createUpdaterPublicLogsPublisher }

function isUpdaterEntrypoint(): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    return false
  }

  const entrypointName = path.basename(entrypoint).toLowerCase()
  return entrypointName === 'updater.js' || entrypointName === 'updater.ts'
}

if (isUpdaterEntrypoint()) {
  void runUpdaterMain()
}
