import type {
  AgentControlBackendState,
  AgentControlPaths,
  AgentOperationalSnapshot,
  AgentReleaseInventory,
} from '@agent/control-core/contracts'

export type AgentTrayIconVariant = 'healthy' | 'warning' | 'danger' | 'busy'

export type AgentTrayAction =
  | 'open-dashboard'
  | 'open-logs'
  | 'open-window'
  | 'restart-agent'
  | 'check-for-updates'
  | 'quit-tray'

export type AgentTrayMenuItemVM =
  | {
      readonly kind: 'item'
      readonly id: string
      readonly label: string
      readonly enabled: boolean
      readonly action?: AgentTrayAction
    }
  | {
      readonly kind: 'separator'
      readonly id: string
    }

export type AgentTrayVM = {
  readonly iconVariant: AgentTrayIconVariant
  readonly tooltip: string
  readonly menuItems: readonly AgentTrayMenuItemVM[]
  readonly balloon: {
    readonly title: string
    readonly content: string
  } | null
}

export type AgentTrayStateInput = {
  readonly snapshot: AgentOperationalSnapshot | null
  readonly backendState: AgentControlBackendState | null
  readonly releaseInventory: AgentReleaseInventory | null
  readonly paths: AgentControlPaths | null
  readonly commandInFlight: boolean
  readonly lastErrorSummary: string | null
}

function formatMissing(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'unknown'
  }

  return value
}

function formatHeartbeat(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Last heartbeat: unknown'
  }

  return `Last heartbeat: ${value}`
}

function isBusy(snapshot: AgentOperationalSnapshot | null, commandInFlight: boolean): boolean {
  if (commandInFlight) {
    return true
  }

  return snapshot !== null && (snapshot.runtime.activeJobs > 0 || hasRunningUpdate(snapshot))
}

function hasRunningUpdate(snapshot: AgentOperationalSnapshot | null): boolean {
  if (snapshot === null) {
    return false
  }

  return snapshot.release.target !== null
}

function resolveIconVariant(command: {
  readonly snapshot: AgentOperationalSnapshot | null
  readonly commandInFlight: boolean
}): AgentTrayIconVariant {
  if (command.commandInFlight || hasRunningUpdate(command.snapshot)) {
    return 'busy'
  }

  if (command.snapshot === null) {
    return 'danger'
  }

  if (
    command.snapshot.runtime.status === 'RUNNING' &&
    command.snapshot.runtime.health === 'HEALTHY'
  ) {
    return 'healthy'
  }

  if (
    command.snapshot.runtime.status === 'STOPPED' ||
    command.snapshot.runtime.status === 'CRASHED' ||
    command.snapshot.runtime.health === 'UNHEALTHY'
  ) {
    return 'danger'
  }

  return 'warning'
}

function resolveStatusLabel(snapshot: AgentOperationalSnapshot | null): string {
  if (snapshot === null) {
    return 'Agent Runtime: disconnected'
  }

  if (snapshot.runtime.status === 'RUNNING' && snapshot.runtime.health === 'HEALTHY') {
    return 'Agent Runtime: connected'
  }

  if (snapshot.runtime.status === 'STOPPED' || snapshot.runtime.status === 'CRASHED') {
    return `Agent Runtime: ${snapshot.runtime.status.toLowerCase()}`
  }

  return `Agent Runtime: ${snapshot.runtime.health.toLowerCase()}`
}

function resolveTooltip(command: {
  readonly snapshot: AgentOperationalSnapshot | null
  readonly commandInFlight: boolean
  readonly lastErrorSummary: string | null
}): string {
  if (command.commandInFlight) {
    return 'Container Tracker Agent - working'
  }

  if (command.lastErrorSummary !== null) {
    return 'Container Tracker Agent - attention required'
  }

  return `Container Tracker - ${resolveStatusLabel(command.snapshot).replace('Agent Runtime: ', '')}`
}

function resolveVersionLabel(command: {
  readonly snapshot: AgentOperationalSnapshot | null
  readonly releaseInventory: AgentReleaseInventory | null
}): string {
  const currentFromSnapshot = command.snapshot?.release.current ?? null
  if (currentFromSnapshot !== null) {
    return `Current version: ${currentFromSnapshot}`
  }

  const currentFromInventory =
    command.releaseInventory?.releases.find((release) => release.isCurrent)?.version ?? null
  return `Current version: ${formatMissing(currentFromInventory)}`
}

function resolveBalloon(input: AgentTrayStateInput): AgentTrayVM['balloon'] {
  if (input.lastErrorSummary !== null) {
    return {
      title: 'Container Tracker Agent',
      content: input.lastErrorSummary,
    }
  }

  return null
}

export function mapAgentTrayState(input: AgentTrayStateInput): AgentTrayVM {
  const iconVariant = resolveIconVariant({
    snapshot: input.snapshot,
    commandInFlight: input.commandInFlight || isBusy(input.snapshot, input.commandInFlight),
  })
  const dashboardAvailable = input.backendState?.backendUrl !== null && input.backendState !== null
  const logsAvailable = input.paths !== null
  const commandsEnabled = !input.commandInFlight
  const updateCheckEnabled = commandsEnabled && input.backendState?.status === 'ENROLLED'

  return {
    iconVariant,
    tooltip: resolveTooltip({
      snapshot: input.snapshot,
      commandInFlight: input.commandInFlight,
      lastErrorSummary: input.lastErrorSummary,
    }),
    menuItems: [
      {
        kind: 'item',
        id: 'status',
        label: resolveStatusLabel(input.snapshot),
        enabled: false,
      },
      {
        kind: 'item',
        id: 'version',
        label: resolveVersionLabel({
          snapshot: input.snapshot,
          releaseInventory: input.releaseInventory,
        }),
        enabled: false,
      },
      {
        kind: 'item',
        id: 'heartbeat',
        label: formatHeartbeat(input.snapshot?.runtime.lastHeartbeatAt ?? null),
        enabled: false,
      },
      { kind: 'separator', id: 'primary-separator' },
      {
        kind: 'item',
        id: 'open-dashboard',
        label: 'Open dashboard',
        enabled: dashboardAvailable,
        action: 'open-dashboard',
      },
      {
        kind: 'item',
        id: 'open-logs',
        label: 'Open logs folder',
        enabled: logsAvailable,
        action: 'open-logs',
      },
      { kind: 'separator', id: 'operations-separator' },
      {
        kind: 'item',
        id: 'restart-agent',
        label: 'Restart agent runtime',
        enabled: commandsEnabled,
        action: 'restart-agent',
      },
      {
        kind: 'item',
        id: 'check-for-updates',
        label: 'Check for updates',
        enabled: updateCheckEnabled,
        action: 'check-for-updates',
      },
      {
        kind: 'item',
        id: 'open-window',
        label: 'Open control window',
        enabled: true,
        action: 'open-window',
      },
      { kind: 'separator', id: 'quit-separator' },
      {
        kind: 'item',
        id: 'quit-tray',
        label: 'Quit tray',
        enabled: true,
        action: 'quit-tray',
      },
    ],
    balloon: resolveBalloon(input),
  }
}
