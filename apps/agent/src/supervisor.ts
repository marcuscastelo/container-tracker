#!/usr/bin/env node

import {
  isSupervisorEntrypoint as isSupervisorEntrypointFromEntry,
  launchSupervisorMain,
} from '@agent/supervisor/supervisor.entry'

export function isSupervisorEntrypoint(entrypoint = process.argv[1]): boolean {
  return isSupervisorEntrypointFromEntry(entrypoint)
}

// Wrapper entrypoint kept for compatibility with release/runtime launchers.
if (isSupervisorEntrypoint()) {
  launchSupervisorMain()
}
