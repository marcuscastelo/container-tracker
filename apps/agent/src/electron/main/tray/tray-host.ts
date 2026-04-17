import type {
  AgentTrayApp,
  AgentTrayRuntimePort,
  AgentTrayShell,
} from '@agent/electron/main/tray/tray.commands'
import { resolveTrayIconPath } from '@agent/electron/main/tray/tray.icons'
import { buildAgentTrayMenu } from '@agent/electron/main/tray/tray.menu'
import { displayAgentTrayBalloon } from '@agent/electron/main/tray/tray-notifications'
import { type AgentTrayVM, mapAgentTrayState } from '@agent/electron/main/tray/tray-state'
import type { Tray } from 'electron'

const TRAY_REFRESH_INTERVAL_MS = 5_000

export type AgentTrayHostDeps = {
  readonly tray: Tray
  readonly port: AgentTrayRuntimePort
  readonly shell: AgentTrayShell
  readonly app: AgentTrayApp
  readonly iconDir: string
  readonly fallbackIconPath?: string | null | undefined
  readonly openWindow: () => void
  readonly setQuitting: () => void
}

export type AgentTrayHost = {
  readonly refresh: () => void
  readonly dispose: () => void
}

function toErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function createDisconnectedVm(error: unknown): AgentTrayVM {
  return mapAgentTrayState({
    snapshot: null,
    backendState: null,
    releaseInventory: null,
    paths: null,
    commandInFlight: false,
    lastErrorSummary: toErrorSummary(error),
  })
}

function setTrayIcon(command: {
  readonly tray: Tray
  readonly iconDir: string
  readonly vm: AgentTrayVM
  readonly fallbackIconPath?: string | null | undefined
}): void {
  const iconPath = resolveTrayIconPath({
    iconDir: command.iconDir,
    variant: command.vm.iconVariant,
    fallbackIconPath: command.fallbackIconPath,
  })
  command.tray.setImage(iconPath)
}

export function createAgentTrayHost(deps: AgentTrayHostDeps): AgentTrayHost {
  let commandInFlight = false
  let lastBalloonContent: string | null = null

  function notify(message: string): void {
    lastBalloonContent = message
    deps.tray.displayBalloon?.({
      title: 'Container Tracker Agent',
      content: message,
    })
  }

  function withCommandInFlight<T>(operation: () => Promise<T>): Promise<T> {
    commandInFlight = true
    refresh()
    return operation().finally(() => {
      commandInFlight = false
      refresh()
    })
  }

  const portWithBusyState: AgentTrayRuntimePort = {
    getBackendState: deps.port.getBackendState,
    getSnapshot: deps.port.getSnapshot,
    getReleaseInventory: deps.port.getReleaseInventory,
    getPaths: deps.port.getPaths,
    restartAgent() {
      return withCommandInFlight(deps.port.restartAgent)
    },
    checkForUpdates() {
      return withCommandInFlight(deps.port.checkForUpdates)
    },
  }

  async function readVm(): Promise<AgentTrayVM> {
    try {
      const [snapshot, backendState, releaseInventory, paths] = await Promise.all([
        deps.port.getSnapshot(),
        deps.port.getBackendState(),
        deps.port.getReleaseInventory(),
        deps.port.getPaths(),
      ])

      return mapAgentTrayState({
        snapshot,
        backendState,
        releaseInventory,
        paths,
        commandInFlight,
        lastErrorSummary: null,
      })
    } catch (error) {
      return createDisconnectedVm(error)
    }
  }

  function applyVm(vm: AgentTrayVM): void {
    setTrayIcon({
      tray: deps.tray,
      iconDir: deps.iconDir,
      vm,
      fallbackIconPath: deps.fallbackIconPath,
    })
    deps.tray.setToolTip(vm.tooltip)
    deps.tray.setContextMenu(
      buildAgentTrayMenu({
        vm,
        deps: {
          port: portWithBusyState,
          shell: deps.shell,
          app: deps.app,
          openWindow: deps.openWindow,
          setQuitting: deps.setQuitting,
          notify,
        },
        refresh,
      }),
    )

    if (vm.balloon?.content !== lastBalloonContent) {
      lastBalloonContent = vm.balloon?.content ?? null
      displayAgentTrayBalloon({ tray: deps.tray, vm })
    }
  }

  function refresh(): void {
    void readVm().then((vm) => {
      applyVm(vm)
    })
  }

  deps.tray.on('click', () => {
    deps.tray.popUpContextMenu()
  })
  deps.tray.on('double-click', () => {
    deps.openWindow()
  })

  refresh()
  const timer = setInterval(refresh, TRAY_REFRESH_INTERVAL_MS)
  timer.unref?.()

  return {
    refresh,
    dispose() {
      clearInterval(timer)
      deps.tray.destroy()
    },
  }
}
