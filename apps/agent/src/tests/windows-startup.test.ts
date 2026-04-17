import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { launchWindowsAgentStartup } from '@agent/platform/windows/startup'
import { afterEach, describe, expect, it, vi } from 'vitest'

const describeOnWindowsHost = process.platform === 'win32' ? describe : describe.skip

function createLayout(rootDir: string): PlatformPathResolution {
  const dataDir = path.join(rootDir, 'data')
  return {
    dataDir,
    releasesDir: path.join(dataDir, 'releases'),
    currentPath: path.join(dataDir, 'current'),
    previousPath: path.join(dataDir, 'previous'),
    releaseStatePath: path.join(dataDir, 'release-state.json'),
    downloadsDir: path.join(dataDir, 'downloads'),
    logsDir: path.join(dataDir, 'logs'),
    bootstrapEnvPath: path.join(dataDir, 'bootstrap.env'),
    configEnvPath: path.join(dataDir, 'config.env'),
    runtimePidPath: path.join(dataDir, 'runtime.pid'),
    runtimeStatePath: path.join(dataDir, 'runtime-state.json'),
    supervisorControlPath: path.join(dataDir, 'supervisor-control.json'),
    publicStateDir: path.join(dataDir, 'run'),
    publicConfigPath: path.join(dataDir, 'run', 'control-base.runtime.json'),
    publicOverridesPath: path.join(dataDir, 'run', 'control-overrides.local.json'),
    publicStatePath: path.join(dataDir, 'run', 'public-control-state.json'),
    backendCachePath: path.join(dataDir, 'run', 'control-remote-cache.json'),
    infraConfigPath: path.join(dataDir, 'run', 'infra-config.json'),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describeOnWindowsHost('windows startup', () => {
  it('clears ELECTRON_RUN_AS_NODE before launching the tray runtime', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-agent-windows-startup-'))
    const installRoot = path.join(rootDir, 'install')
    const controlUiDir = path.join(installRoot, 'control-ui')
    const electronExePath = path.join(installRoot, 'electron', 'electron.exe')
    const iconPath = path.join(installRoot, 'app', 'assets', 'tray.ico')

    fs.mkdirSync(path.join(controlUiDir), { recursive: true })
    fs.mkdirSync(path.dirname(electronExePath), { recursive: true })
    fs.mkdirSync(path.dirname(iconPath), { recursive: true })
    fs.writeFileSync(path.join(controlUiDir, 'package.json'), '{"name":"control-ui"}\n', 'utf8')
    fs.writeFileSync(electronExePath, '', 'utf8')
    fs.writeFileSync(iconPath, '', 'utf8')

    const spawnDetached = vi.fn()
    const layout = createLayout(rootDir)

    launchWindowsAgentStartup({
      env: {
        LOCALAPPDATA: rootDir,
        CT_AGENT_INSTALL_ROOT: installRoot,
        ELECTRON_RUN_AS_NODE: '1',
      },
      argv: ['--tray-only'],
      resolvePaths() {
        return layout
      },
      spawnDetached,
      isProcessAlive() {
        return false
      },
      nowIso() {
        return '2026-04-16T00:00:00.000Z'
      },
    })

    expect(spawnDetached).toHaveBeenCalledTimes(1)
    expect(spawnDetached).toHaveBeenCalledWith(
      electronExePath,
      [controlUiDir],
      expect.objectContaining({
        env: expect.not.objectContaining({
          ELECTRON_RUN_AS_NODE: '1',
        }),
      }),
    )

    fs.rmSync(rootDir, { recursive: true, force: true })
  })
})
