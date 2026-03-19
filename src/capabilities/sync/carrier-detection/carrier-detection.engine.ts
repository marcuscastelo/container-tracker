import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { CarrierDetectionPolicy } from '~/capabilities/sync/carrier-detection/carrier-detection.policy'
import {
  listCarrierDetectionCandidates,
  normalizeContainerNumber,
} from '~/capabilities/sync/carrier-detection/carrier-detection.providers'

export type CarrierProbeResult =
  | { readonly kind: 'found'; readonly rawResultRef?: string | null }
  | { readonly kind: 'not_found'; readonly rawResultRef?: string | null }
  | { readonly kind: 'error'; readonly error: string; readonly rawResultRef?: string | null }

export type CarrierDetectionAttempt = {
  readonly provider: SupportedSyncProvider
  readonly status: 'FOUND' | 'NOT_FOUND' | 'ERROR'
  readonly errorCode: string | null
  readonly rawResultRef: string | null
}

export type CarrierDetectionResult =
  | {
      readonly detected: true
      readonly provider: SupportedSyncProvider
      readonly candidateProviders?: readonly SupportedSyncProvider[]
      readonly attemptedProviders: readonly SupportedSyncProvider[]
      readonly attempts?: readonly CarrierDetectionAttempt[]
      readonly reason: 'found'
      readonly error: null
    }
  | {
      readonly detected: false
      readonly provider: null
      readonly candidateProviders?: readonly SupportedSyncProvider[]
      readonly attemptedProviders: readonly SupportedSyncProvider[]
      readonly attempts?: readonly CarrierDetectionAttempt[]
      readonly reason: 'not_found' | 'provider_error' | 'rate_limited'
      readonly error: string | null
    }

type CarrierDetectionEngine = {
  readonly detectCarrier: (command: {
    readonly tenantId: string
    readonly containerNumber: string
    readonly excludeProviders?: readonly SupportedSyncProvider[]
  }) => Promise<CarrierDetectionResult>
}

export function createCarrierDetectionEngine(deps: {
  readonly policy: CarrierDetectionPolicy
  readonly probeProvider: (command: {
    readonly tenantId: string
    readonly containerNumber: string
    readonly provider: SupportedSyncProvider
  }) => Promise<CarrierProbeResult>
  readonly nowMs?: () => number
  readonly log?: (message: string, meta: Readonly<Record<string, unknown>>) => void
}): CarrierDetectionEngine {
  const nowMs = deps.nowMs ?? Date.now
  const log =
    deps.log ??
    ((message: string, meta: Readonly<Record<string, unknown>>) => {
      console.info(message, meta)
    })

  return {
    async detectCarrier(command) {
      const containerNumber = normalizeContainerNumber(command.containerNumber)
      const decision = deps.policy.consumeBudget({ containerNumber })
      if (!decision.allowed) {
        const result: CarrierDetectionResult = {
          detected: false,
          provider: null,
          candidateProviders: [],
          attemptedProviders: [],
          attempts: [],
          reason: 'rate_limited',
          error: 'carrier_detection_rate_limited',
        }
        log('[sync] carrier detection skipped', {
          containerNumber,
          candidateProviders: [],
          detectedProvider: null,
          durationMs: 0,
          reason: result.reason,
        })
        return result
      }

      const startedAtMs = nowMs()
      const candidateProviders = listCarrierDetectionCandidates({
        excludeProviders: command.excludeProviders,
      }).slice(0, decision.maxProviders)
      const attemptedProviders: SupportedSyncProvider[] = []
      const attempts: CarrierDetectionAttempt[] = []

      for (const provider of candidateProviders) {
        attemptedProviders.push(provider)
        const probeResult = await deps.probeProvider({
          tenantId: command.tenantId,
          containerNumber,
          provider,
        })

        if (probeResult.kind === 'found') {
          attempts.push({
            provider,
            status: 'FOUND',
            errorCode: null,
            rawResultRef: probeResult.rawResultRef ?? null,
          })
          const durationMs = Math.max(0, nowMs() - startedAtMs)
          const result: CarrierDetectionResult = {
            detected: true,
            provider,
            candidateProviders,
            attemptedProviders,
            attempts,
            reason: 'found',
            error: null,
          }
          log('[sync] carrier detection completed', {
            containerNumber,
            candidateProviders,
            detectedProvider: provider,
            durationMs,
            reason: result.reason,
          })
          return result
        }

        if (probeResult.kind === 'error') {
          attempts.push({
            provider,
            status: 'ERROR',
            errorCode: probeResult.error,
            rawResultRef: probeResult.rawResultRef ?? null,
          })
          const durationMs = Math.max(0, nowMs() - startedAtMs)
          const result: CarrierDetectionResult = {
            detected: false,
            provider: null,
            candidateProviders,
            attemptedProviders,
            attempts,
            reason: 'provider_error',
            error: probeResult.error,
          }
          log('[sync] carrier detection failed', {
            containerNumber,
            candidateProviders,
            detectedProvider: null,
            durationMs,
            reason: result.reason,
            error: probeResult.error,
          })
          return result
        }

        attempts.push({
          provider,
          status: 'NOT_FOUND',
          errorCode: null,
          rawResultRef: probeResult.rawResultRef ?? null,
        })
      }

      const durationMs = Math.max(0, nowMs() - startedAtMs)
      const result: CarrierDetectionResult = {
        detected: false,
        provider: null,
        candidateProviders,
        attemptedProviders,
        attempts,
        reason: 'not_found',
        error: 'carrier_detection_not_found',
      }
      log('[sync] carrier detection completed', {
        containerNumber,
        candidateProviders,
        detectedProvider: null,
        durationMs,
        reason: result.reason,
      })
      return result
    },
  }
}

export type { CarrierDetectionEngine }
