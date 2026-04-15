import { readRuntimeHealth } from '@agent/runtime/infrastructure/runtime-health.repository'

export function readRuntimePid(healthPath: string): number | null {
  const state = readRuntimeHealth(healthPath)
  return state?.pid ?? null
}
