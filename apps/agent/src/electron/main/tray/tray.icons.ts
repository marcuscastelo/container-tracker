import fs from 'node:fs'
import path from 'node:path'
import type { AgentTrayIconVariant } from '@agent/electron/main/tray/tray-state'

const ICON_FILE_BY_VARIANT: Record<AgentTrayIconVariant, readonly string[]> = {
  healthy: ['tray-healthy.ico', 'tray.ico'],
  warning: ['tray-warning.ico', 'tray.ico'],
  danger: ['tray-danger.ico', 'tray.ico'],
  busy: ['tray-busy.ico', 'tray.ico'],
}

export function resolveTrayIconPath(command: {
  readonly iconDir: string
  readonly variant: AgentTrayIconVariant
  readonly fallbackIconPath?: string | null | undefined
}): string {
  for (const fileName of ICON_FILE_BY_VARIANT[command.variant]) {
    const candidate = path.join(command.iconDir, fileName)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  if (
    typeof command.fallbackIconPath === 'string' &&
    command.fallbackIconPath.trim().length > 0 &&
    fs.existsSync(command.fallbackIconPath)
  ) {
    return command.fallbackIconPath
  }

  throw new Error(`Tray icon asset was not found in ${command.iconDir}`)
}
