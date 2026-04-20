import type { AgentTrayCommandDeps } from '@agent/electron/main/tray/tray.commands'
import { executeAgentTrayAction } from '@agent/electron/main/tray/tray.commands'
import type { AgentTrayMenuItemVM, AgentTrayVM } from '@agent/electron/main/tray/tray-state'
import type { Menu, MenuItemConstructorOptions } from 'electron'
import { Menu as ElectronMenu } from 'electron'

function toElectronMenuItem(
  item: AgentTrayMenuItemVM,
  deps: AgentTrayCommandDeps,
  refresh: () => void,
): MenuItemConstructorOptions {
  if (item.kind === 'separator') {
    return { type: 'separator' }
  }

  if (item.action === undefined) {
    return {
      label: item.label,
      enabled: item.enabled,
    }
  }

  const action = item.action
  return {
    label: item.label,
    enabled: item.enabled,
    click() {
      void executeAgentTrayAction(action, deps).finally(() => {
        refresh()
      })
    },
  }
}

export function buildAgentTrayMenu(command: {
  readonly vm: AgentTrayVM
  readonly deps: AgentTrayCommandDeps
  readonly refresh: () => void
}): Menu {
  return ElectronMenu.buildFromTemplate(
    command.vm.menuItems.map((item) => toElectronMenuItem(item, command.deps, command.refresh)),
  )
}
