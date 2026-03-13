import { normalizeContainerNumber } from '~/capabilities/sync/carrier-detection/carrier-detection.providers'

const DEFAULT_MAX_PROVIDERS_PER_DETECTION = 5
const DEFAULT_MAX_DETECTIONS_PER_CONTAINER_PER_HOUR = 2
const ONE_HOUR_MS = 60 * 60 * 1000

export type CarrierDetectionPolicyDecision =
  | {
      readonly allowed: true
      readonly maxProviders: number
    }
  | {
      readonly allowed: false
      readonly reason: 'rate_limited'
      readonly maxProviders: number
    }

export type CarrierDetectionPolicy = {
  readonly consumeBudget: (command: {
    readonly containerNumber: string
  }) => CarrierDetectionPolicyDecision
}

export function createCarrierDetectionPolicy(deps?: {
  readonly nowMs?: () => number
  readonly maxProvidersPerDetection?: number
  readonly maxDetectionsPerContainerPerHour?: number
}): CarrierDetectionPolicy {
  const nowMs = deps?.nowMs ?? Date.now
  const maxProvidersPerDetection =
    deps?.maxProvidersPerDetection ?? DEFAULT_MAX_PROVIDERS_PER_DETECTION
  const maxDetectionsPerContainerPerHour =
    deps?.maxDetectionsPerContainerPerHour ?? DEFAULT_MAX_DETECTIONS_PER_CONTAINER_PER_HOUR
  const attemptsByContainer = new Map<string, number[]>()

  return {
    consumeBudget(command) {
      const containerNumber = normalizeContainerNumber(command.containerNumber)
      const cutoffMs = nowMs() - ONE_HOUR_MS
      const existingAttempts = attemptsByContainer.get(containerNumber) ?? []
      const recentAttempts = existingAttempts.filter((attemptMs) => attemptMs > cutoffMs)

      if (recentAttempts.length >= maxDetectionsPerContainerPerHour) {
        attemptsByContainer.set(containerNumber, recentAttempts)
        return {
          allowed: false,
          reason: 'rate_limited',
          maxProviders: maxProvidersPerDetection,
        }
      }

      recentAttempts.push(nowMs())
      attemptsByContainer.set(containerNumber, recentAttempts)

      return {
        allowed: true,
        maxProviders: maxProvidersPerDetection,
      }
    },
  }
}
