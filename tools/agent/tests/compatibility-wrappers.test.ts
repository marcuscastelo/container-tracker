import { resolveAgentPathLayout as resolveCanonicalAgentPathLayout } from '@tools/agent/config/resolve-agent-paths'
import { agentControlIpcChannels as canonicalIpcChannels } from '@tools/agent/electron/ipc'
import { createInstalledLinuxControlService as createCanonicalInstalledLinuxControlService } from '@tools/agent/electron/main/installed-linux-control-service'
import { createWindowLifecycleController as createCanonicalWindowLifecycleController } from '@tools/agent/electron/main/window-controller'
import { resolveAgentPathLayout as resolveLegacyAgentPathLayout } from '@tools/agent/runtime-paths'
import { agentControlIpcChannels as legacyIpcChannels } from '@tools/agent-control-ui/ipc'
import { createInstalledLinuxControlService as createLegacyInstalledLinuxControlService } from '@tools/agent-control-ui/linux-installed-service'
import { createWindowLifecycleController as createLegacyWindowLifecycleController } from '@tools/agent-control-ui/window-controller'
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
