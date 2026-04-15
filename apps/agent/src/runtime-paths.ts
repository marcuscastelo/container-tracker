import type { AgentPathLayout as CanonicalAgentPathLayout } from '@agent/config/config.contract'
import {
  ensureAgentPathLayout as canonicalEnsureAgentPathLayout,
  resolveAgentPathLayout as canonicalResolveAgentPathLayout,
  resolveCurrentRelease as canonicalResolveCurrentRelease,
  resolveDataDir as canonicalResolveDataDir,
  resolveInstalledLinuxAgentPathLayout as canonicalResolveInstalledLinuxAgentPathLayout,
  resolveReleasesDir as canonicalResolveReleasesDir,
} from '@agent/config/resolve-agent-paths'
import {
  resolveAgentConfigDir as canonicalResolveAgentConfigDir,
  resolveAgentDataDir as canonicalResolveAgentDataDir,
  resolveAgentPublicBackendStatePath as canonicalResolveAgentPublicBackendStatePath,
  resolveAgentPublicLogsPath as canonicalResolveAgentPublicLogsPath,
  resolveAgentPublicStateDir as canonicalResolveAgentPublicStateDir,
  resolveAgentPublicStatePath as canonicalResolveAgentPublicStatePath,
  resolveLogsDir as canonicalResolveLogsDir,
  resolveReleaseStatePath as canonicalResolveReleaseStatePath,
} from '@agent/runtime/paths'

export type AgentPathLayout = CanonicalAgentPathLayout
export const ensureAgentPathLayout = canonicalEnsureAgentPathLayout
export const resolveAgentPathLayout = canonicalResolveAgentPathLayout
export const resolveCurrentRelease = canonicalResolveCurrentRelease
export const resolveDataDir = canonicalResolveDataDir
export const resolveInstalledLinuxAgentPathLayout = canonicalResolveInstalledLinuxAgentPathLayout
export const resolveReleasesDir = canonicalResolveReleasesDir
export const resolveAgentConfigDir = canonicalResolveAgentConfigDir
export const resolveAgentDataDir = canonicalResolveAgentDataDir
export const resolveAgentPublicBackendStatePath = canonicalResolveAgentPublicBackendStatePath
export const resolveAgentPublicLogsPath = canonicalResolveAgentPublicLogsPath
export const resolveAgentPublicStateDir = canonicalResolveAgentPublicStateDir
export const resolveAgentPublicStatePath = canonicalResolveAgentPublicStatePath
export const resolveLogsDir = canonicalResolveLogsDir
export const resolveReleaseStatePath = canonicalResolveReleaseStatePath
