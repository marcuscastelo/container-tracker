type DashboardNavigationWindow = {
  readonly scrollY: number
  readonly scrollTo: (x: number, y: number) => void
}

export type DashboardNavigationState = {
  readonly lastOpenedProcessId: string
  readonly scrollY: number
}

export type DashboardNavigationStateEnvironment = {
  readonly window?: DashboardNavigationWindow | undefined
}

let dashboardNavigationState: DashboardNavigationState | null = null

function resolveDashboardNavigationWindow(
  environment?: DashboardNavigationStateEnvironment,
): DashboardNavigationWindow | undefined {
  return environment?.window ?? (typeof window === 'undefined' ? undefined : window)
}

export function clearDashboardNavigationState(): void {
  dashboardNavigationState = null
}

export function readDashboardNavigationState(): DashboardNavigationState | null {
  return dashboardNavigationState
}

export function saveDashboardNavigationState(command: {
  readonly lastOpenedProcessId: string
  readonly environment?: DashboardNavigationStateEnvironment
}): void {
  const processId = command.lastOpenedProcessId.trim()
  if (processId.length === 0) {
    clearDashboardNavigationState()
    return
  }

  dashboardNavigationState = {
    lastOpenedProcessId: processId,
    scrollY: Math.max(0, resolveDashboardNavigationWindow(command.environment)?.scrollY ?? 0),
  }
}

export function restoreDashboardScrollPosition(command: {
  readonly state: DashboardNavigationState | null
  readonly environment?: DashboardNavigationStateEnvironment
}): boolean {
  if (command.state === null) return false

  const currentWindow = resolveDashboardNavigationWindow(command.environment)
  if (!currentWindow) return false

  currentWindow.scrollTo(0, command.state.scrollY)
  return true
}

export function resolveHighlightedDashboardProcessId(command: {
  readonly processes: readonly { readonly id: string }[]
  readonly lastOpenedProcessId: string | null
}): string | null {
  if (command.lastOpenedProcessId === null) return null

  for (const process of command.processes) {
    if (process.id === command.lastOpenedProcessId) {
      return command.lastOpenedProcessId
    }
  }

  return null
}
