import process from 'node:process'

export function resolveNodePlatform(): NodeJS.Platform {
  return process.platform
}

export function isWindowsPlatform(platform = resolveNodePlatform()): boolean {
  return platform === 'win32'
}

export function isLinuxPlatform(platform = resolveNodePlatform()): boolean {
  return platform === 'linux'
}

export function isMacPlatform(platform = resolveNodePlatform()): boolean {
  return platform === 'darwin'
}

export function resolveDirectorySymlinkType(platform = resolveNodePlatform()): 'junction' | 'dir' {
  return isWindowsPlatform(platform) ? 'junction' : 'dir'
}
