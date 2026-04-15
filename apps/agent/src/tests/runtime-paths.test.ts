import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { linuxPlatformAdapter } from '@agent/platform/linux.adapter'
import { windowsPlatformAdapter } from '@agent/platform/windows.adapter'
import { describe, expect, it } from 'vitest'

describe('platform path abstraction', () => {
  it('resolves canonical Linux paths and defaults public state to DATA_DIR/run', () => {
    const paths = linuxPlatformAdapter.resolvePaths({
      env: {
        AGENT_DATA_DIR: '/tmp/custom-agent-data',
      },
      cwd: '/workspace',
    })

    expect(paths.dataDir).toBe('/tmp/custom-agent-data')
    expect(paths.releasesDir).toBe('/tmp/custom-agent-data/releases')
    expect(paths.currentPath).toBe('/tmp/custom-agent-data/current')
    expect(paths.previousPath).toBe('/tmp/custom-agent-data/previous')
    expect(paths.releaseStatePath).toBe('/tmp/custom-agent-data/release-state.json')
    expect(paths.runtimeStatePath).toBe('/tmp/custom-agent-data/runtime-state.json')
    expect(paths.configEnvPath).toBe('/tmp/custom-agent-data/config.env')
    expect(paths.bootstrapEnvPath).toBe('/tmp/custom-agent-data/bootstrap.env')
    expect(paths.publicStateDir).toBe('/tmp/custom-agent-data/run')
    expect(paths.publicStatePath).toBe('/tmp/custom-agent-data/run/control-ui-state.json')
  })

  it('resolves canonical Windows paths using LOCALAPPDATA', () => {
    const paths = windowsPlatformAdapter.resolvePaths({
      env: {
        LOCALAPPDATA: 'C:\\Users\\Agent\\AppData\\Local',
      },
      cwd: 'C:\\workspace',
    })

    expect(paths.dataDir).toBe('C:\\Users\\Agent\\AppData\\Local\\ContainerTracker')
    expect(paths.releasesDir).toBe('C:\\Users\\Agent\\AppData\\Local\\ContainerTracker\\releases')
    expect(paths.currentPath).toBe('C:\\Users\\Agent\\AppData\\Local\\ContainerTracker\\current')
    expect(paths.previousPath).toBe('C:\\Users\\Agent\\AppData\\Local\\ContainerTracker\\previous')
    expect(paths.runtimeStatePath).toBe(
      'C:\\Users\\Agent\\AppData\\Local\\ContainerTracker\\runtime-state.json',
    )
    expect(paths.publicStateDir).toBe('C:\\Users\\Agent\\AppData\\Local\\ContainerTracker\\run')
  })

  it('switches release pointers through the Linux adapter', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-platform-switch-'))
    const releasesDir = path.join(baseDir, 'releases')
    const v1 = path.join(releasesDir, '1.0.0')
    const v2 = path.join(releasesDir, '2.0.0')
    const currentPath = path.join(baseDir, 'current')
    const previousPath = path.join(baseDir, 'previous')

    fs.mkdirSync(v1, { recursive: true })
    fs.mkdirSync(v2, { recursive: true })

    linuxPlatformAdapter.switchCurrentRelease({
      currentPath,
      previousPath,
      targetPath: v1,
    })
    expect(linuxPlatformAdapter.readSymlinkOrPointer({ pointerPath: currentPath })).toBe(v1)

    linuxPlatformAdapter.switchCurrentRelease({
      currentPath,
      previousPath,
      targetPath: v2,
    })
    expect(linuxPlatformAdapter.readSymlinkOrPointer({ pointerPath: currentPath })).toBe(v2)
    expect(linuxPlatformAdapter.readSymlinkOrPointer({ pointerPath: previousPath })).toBe(v1)
  })

  it('switches release pointers through the Windows adapter', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-platform-switch-win-'))
    const releasesDir = path.join(baseDir, 'releases')
    const v1 = path.join(releasesDir, '1.0.0')
    const v2 = path.join(releasesDir, '2.0.0')
    const currentPath = path.join(baseDir, 'current')
    const previousPath = path.join(baseDir, 'previous')

    fs.mkdirSync(v1, { recursive: true })
    fs.mkdirSync(v2, { recursive: true })

    windowsPlatformAdapter.switchCurrentRelease({
      currentPath,
      previousPath,
      targetPath: v1,
    })
    expect(windowsPlatformAdapter.readSymlinkOrPointer({ pointerPath: currentPath })).toBe(v1)

    windowsPlatformAdapter.switchCurrentRelease({
      currentPath,
      previousPath,
      targetPath: v2,
    })
    expect(windowsPlatformAdapter.readSymlinkOrPointer({ pointerPath: currentPath })).toBe(v2)
    expect(windowsPlatformAdapter.readSymlinkOrPointer({ pointerPath: previousPath })).toBe(v1)
  })
})
