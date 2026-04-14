import { resolveAgentPathLayout as resolveCanonicalAgentPathLayout } from '@agent/config/resolve-agent-paths'
import { agentControlIpcChannels as canonicalIpcChannels } from '@agent/electron/ipc'
import { agentControlIpcChannels as legacyIpcChannels } from '@agent/electron/ipc-compat'
import { createInstalledLinuxControlService as createLegacyInstalledLinuxControlService } from '@agent/electron/linux-installed-service'
import { createInstalledLinuxControlService as createCanonicalInstalledLinuxControlService } from '@agent/electron/main/installed-linux-control-service'
import { createWindowLifecycleController as createCanonicalWindowLifecycleController } from '@agent/electron/main/window-controller'
import { createWindowLifecycleController as createLegacyWindowLifecycleController } from '@agent/electron/window-controller'
import { resolveAgentPathLayout as resolveLegacyAgentPathLayout } from '@agent/runtime-paths'
import { describe, expect, it } from 'vitest'

describe('agent compatibility wrappers', () => {
  it('keeps runtime-paths pointed at the canonical resolver', () => {
    expect(resolveLegacyAgentPathLayout).toBe(resolveCanonicalAgentPathLayout)
  })

  it('keeps legacy Electron IPC exports pointed at the canonical module', () => {
    expect(legacyIpcChannels).toBe(canonicalIpcChannels)
  })

  it('keeps installed Linux control-service wrapper pointed at the canonical module', () => {
    expect(createLegacyInstalledLinuxControlService).toBe(
      createCanonicalInstalledLinuxControlService,
    )
  })

  it('keeps window-controller wrapper pointed at the canonical module', () => {
    expect(createLegacyWindowLifecycleController).toBe(createCanonicalWindowLifecycleController)
  })
})
