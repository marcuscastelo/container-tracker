import fs from 'node:fs'

import {
  buildWindowsStartupLauncherNodeArgs,
  buildWindowsStartupLauncherSpawnOptions,
  launchWindowsStartupLauncher,
  resolveWindowsStartupLauncherLaunchMode,
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
    const spawnLauncher = vi.fn()

    const result = launchWindowsStartupLauncher({
      execPath:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv0:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv: ['--runtime-only', '--tray-only'],
      spawnLauncher,
      stdioInfo: {
        stdinIsTTY: false,
        stdoutIsTTY: false,
        stderrIsTTY: false,
      },
    })

    expect(spawnLauncher).toHaveBeenCalledTimes(1)
    expect(spawnLauncher).toHaveBeenCalledWith(
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
    expect(result.launchMode).toBe('detached')
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
    const spawnLauncher = vi.fn()

    const result = launchWindowsStartupLauncher({
      execPath: 'C:\\Users\\Admin\\Repo\\container-tracker\\release\\ct-agent-startup.exe',
      argv0:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv: [],
      spawnLauncher,
      stdioInfo: {
        stdinIsTTY: false,
        stdoutIsTTY: false,
        stderrIsTTY: false,
      },
    })

    expect(result.installRoot).toBe(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
    )
    expect(spawnLauncher).toHaveBeenCalledWith(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\node\\node.exe',
      expect.any(Array),
      expect.objectContaining({
        cwd: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
      }),
    )
  })

  it('reuses the parent terminal when the launcher inherits tty handles', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const spawnLauncher = vi.fn()

    const result = launchWindowsStartupLauncher({
      execPath:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv0:
        'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\ct-agent-startup.exe',
      argv: [],
      spawnLauncher,
      stdioInfo: {
        stdinIsTTY: false,
        stdoutIsTTY: true,
        stderrIsTTY: false,
      },
    })

    expect(spawnLauncher).toHaveBeenCalledWith(
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent\\node\\node.exe',
      expect.any(Array),
      expect.objectContaining({
        detached: false,
        stdio: 'inherit',
        windowsHide: false,
      }),
    )
    expect(result.launchMode).toBe('attached')
  })

  it('detects attached mode when any inherited stdio handle is interactive', () => {
    expect(
      resolveWindowsStartupLauncherLaunchMode({
        stdinIsTTY: false,
        stdoutIsTTY: true,
        stderrIsTTY: false,
      }),
    ).toBe('attached')
    expect(
      resolveWindowsStartupLauncherLaunchMode({
        stdinIsTTY: false,
        stdoutIsTTY: false,
        stderrIsTTY: false,
      }),
    ).toBe('detached')
  })

  it('builds spawn options that stay hidden only for detached launches', () => {
    expect(
      buildWindowsStartupLauncherSpawnOptions({
        installRoot: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
        env: {},
        launchMode: 'detached',
      }),
    ).toEqual({
      cwd: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
      detached: true,
      env: {
        CT_AGENT_INSTALL_ROOT: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
      },
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    })

    expect(
      buildWindowsStartupLauncherSpawnOptions({
        installRoot: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
        env: {},
        launchMode: 'attached',
      }),
    ).toEqual({
      cwd: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
      detached: false,
      env: {
        CT_AGENT_INSTALL_ROOT: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\ContainerTrackerAgent',
      },
      shell: false,
      stdio: 'inherit',
      windowsHide: false,
    })
  })
})
