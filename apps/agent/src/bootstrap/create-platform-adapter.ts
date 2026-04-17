import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'

export function createPlatformAdapter(command?: {
  readonly platform?: NodeJS.Platform
  readonly arch?: string
}) {
  return resolvePlatformAdapter(command)
}
