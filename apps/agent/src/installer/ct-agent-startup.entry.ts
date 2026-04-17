import process from 'node:process'

import { launchWindowsStartupLauncher } from '@agent/installer/ct-agent-startup.lib'

try {
  launchWindowsStartupLauncher()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[ct-agent-startup] ${message}\n`)
  process.exitCode = 1
}
