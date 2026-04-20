import { describe, expect, it } from 'vitest'

import {
  createPostjectInvocation,
  createStartupLauncherEsbuildOptions,
  createStartupLauncherSeaConfig,
  DEFAULT_NODE_WINDOWS_VERSION,
  NODE_SEA_RESOURCE_NAME,
  NODE_SEA_SENTINEL_FUSE,
  resolveHostRuntimeDescriptor,
  resolveWindowsRuntimeDescriptor,
} from '../agent/build-windows-startup-launcher.mjs'

describe('build-windows-startup-launcher', () => {
  it('bundles the launcher entrypoint as a single CommonJS file for Node SEA', () => {
    const options = createStartupLauncherEsbuildOptions({
      entryPath: '/repo/apps/agent/src/installer/ct-agent-startup.entry.ts',
      outfile: '/tmp/ct-agent-startup.cjs',
    })

    expect(options.entryPoints).toEqual([
      '/repo/apps/agent/src/installer/ct-agent-startup.entry.ts',
    ])
    expect(options.outfile).toBe('/tmp/ct-agent-startup.cjs')
    expect(options.bundle).toBe(true)
    expect(options.platform).toBe('node')
    expect(options.format).toBe('cjs')
    expect(options.target).toEqual(['node22.11'])
  })

  it('generates a SEA config with snapshot and code cache disabled', () => {
    const config = createStartupLauncherSeaConfig({
      mainPath: '/tmp/ct-agent-startup.cjs',
      outputBlobPath: '/tmp/ct-agent-startup.blob',
    })

    expect(config).toEqual({
      main: '/tmp/ct-agent-startup.cjs',
      output: '/tmp/ct-agent-startup.blob',
      useSnapshot: false,
      useCodeCache: false,
      disableExperimentalSEAWarning: true,
    })
  })

  it('uses the pinned Windows Node runtime descriptor', () => {
    const descriptor = resolveWindowsRuntimeDescriptor(DEFAULT_NODE_WINDOWS_VERSION)

    expect(descriptor.archiveName).toBe('node-v22.11.0-win-x64.zip')
    expect(descriptor.archiveSha256).toBe(
      '905373a059aecaf7f48c1ce10ffbd5334457ca00f678747f19db5ea7d256c236',
    )
    expect(descriptor.executableRelativePath).toBe('node.exe')
  })

  it('resolves a pinned Linux host runtime for SEA blob generation in CI', () => {
    const descriptor = resolveHostRuntimeDescriptor({
      nodeVersion: DEFAULT_NODE_WINDOWS_VERSION,
      platform: 'linux',
      arch: 'x64',
    })

    expect(descriptor.archiveName).toBe('node-v22.11.0-linux-x64.tar.xz')
    expect(descriptor.archiveSha256).toBe(
      '83bf07dd343002a26211cf1fcd46a9d9534219aad42ee02847816940bf610a72',
    )
    expect(descriptor.executableRelativePath).toBe('bin/node')
  })

  it('invokes postject with the Node SEA resource and sentinel fuse', () => {
    const invocation = createPostjectInvocation({
      executablePath: 'C:\\release\\ct-agent-startup.exe',
      blobPath: 'C:\\tmp\\ct-agent-startup.blob',
    })

    expect(invocation.resourceName).toBe(NODE_SEA_RESOURCE_NAME)
    expect(invocation.sentinelFuse).toBe(NODE_SEA_SENTINEL_FUSE)
    expect(invocation.args).toEqual([
      'C:\\release\\ct-agent-startup.exe',
      'NODE_SEA_BLOB',
      'C:\\tmp\\ct-agent-startup.blob',
      '--sentinel-fuse',
      'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    ])
  })
})
