import type { AgentTrayVM } from '@agent/electron/main/tray/tray-state'

export type AgentTrayNotificationTarget = {
  readonly displayBalloon?: (options: { readonly title: string; readonly content: string }) => void
}

export function displayAgentTrayBalloon(command: {
  readonly tray: AgentTrayNotificationTarget
  readonly vm: AgentTrayVM
}): void {
  if (command.vm.balloon === null || typeof command.tray.displayBalloon !== 'function') {
    return
  }

  command.tray.displayBalloon(command.vm.balloon)
}
