import fs from 'node:fs'

import {
  buildWindowsStartupLauncherNodeArgs,
  launchWindowsStartupLauncher,
  resolveWindowsStartupLauncherPaths,
} from '@agent/installer/ct-agent-startup.lib'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('windows startup launcher entry', () => {
  it('resolves installed node and startup paths from process.execPath', () => {
    const paths = resolveWindowsStartupLauncherPaths(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
    )

    expect(paths.installRoot).toBe(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
    )
    expect(paths.nodePath).toBe(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\node\\node.exe',
    )
    expect(paths.startupScriptPath).toBe(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\app\\dist\\apps\\agent\\src\\platform\\windows\\startup.js',
    )
    expect(paths.aliasLoaderPath).toBe(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\app\\dist\\apps\\agent\\src\\runtime\\register-alias-loader.js',
    )
  })

  it('prepends the alias loader when the installed runtime provides it', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((candidatePath) =>
      String(candidatePath).endsWith('register-alias-loader.js'),
    )

    const nodeArgs = buildWindowsStartupLauncherNodeArgs({
      paths: resolveWindowsStartupLauncherPaths(
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      ),
      forwardedArgv: ['--runtime-only'],
    })

    expect(nodeArgs[0]).toContain('--import=file:///')
    expect(nodeArgs[0]).toContain('register-alias-loader.js')
    expect(nodeArgs).toContain(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\app\\dist\\apps\\agent\\src\\platform\\windows\\startup.js',
    )
    expect(nodeArgs).toContain('--runtime-only')
  })

  it('launches node.exe detached and forwards runtime/tray flags unchanged', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const spawnDetached = vi.fn()

    const result = launchWindowsStartupLauncher({
      execPath:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv0:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv: ['--runtime-only', '--tray-only'],
      spawnDetached,
    })

    expect(spawnDetached).toHaveBeenCalledTimes(1)
    expect(spawnDetached).toHaveBeenCalledWith(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\node\\node.exe',
      expect.arrayContaining(['--runtime-only', '--tray-only']),
      expect.objectContaining({
        cwd: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
        detached: true,
        env: expect.objectContaining({
          CT_AGENT_INSTALL_ROOT:
            'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
        }),
        stdio: 'ignore',
        shell: false,
        windowsHide: true,
      }),
    )
    expect(result.forwardedArgv).toEqual(['--runtime-only', '--tray-only'])
  })

  it('prefers argv0 when the SEA runtime is copied to a new install root', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((candidatePath) => {
      const normalized = String(candidatePath)
      return (
        normalized ===
          'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe' ||
        normalized.endsWith('node\\node.exe') ||
        normalized.endsWith('startup.js')
      )
    })
    const spawnDetached = vi.fn()

    const result = launchWindowsStartupLauncher({
      execPath: 'C:\\Users\\Admin\\Repo\\container-tracker\\release\\ct-agent-startup.exe',
      argv0:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv: [],
      spawnDetached,
    })

    expect(result.installRoot).toBe(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
    )
    expect(spawnDetached).toHaveBeenCalledWith(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\node\\node.exe',
      expect.any(Array),
      expect.objectContaining({
        cwd: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
      }),
    )
  })
})
