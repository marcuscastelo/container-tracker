#!/usr/bin/env node

import { runSupervisorMain } from '@agent/supervisor/supervisor.entry'

void runSupervisorMain().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[supervisor] fatal error: ${message}`)
  process.exitCode = 1
})
