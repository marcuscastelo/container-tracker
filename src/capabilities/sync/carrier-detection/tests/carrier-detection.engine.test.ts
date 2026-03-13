import { describe, expect, it, vi } from 'vitest'
import { createCarrierDetectionEngine } from '~/capabilities/sync/carrier-detection/carrier-detection.engine'
import { createCarrierDetectionPolicy } from '~/capabilities/sync/carrier-detection/carrier-detection.policy'

describe('carrier-detection.engine', () => {
  it('detects the first provider that confirms the container exists', async () => {
    const probeProvider = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'not_found' })
      .mockResolvedValueOnce({ kind: 'found' })

    const engine = createCarrierDetectionEngine({
      policy: createCarrierDetectionPolicy(),
      probeProvider,
      log: vi.fn(),
    })

    const result = await engine.detectCarrier({
      tenantId: 'tenant-a',
      containerNumber: 'MSCU1234567',
    })

    expect(result).toEqual({
      detected: true,
      provider: 'maersk',
      attemptedProviders: ['msc', 'maersk'],
      reason: 'found',
      error: null,
    })
    expect(probeProvider).toHaveBeenCalledTimes(2)
  })

  it('stops probing when a provider returns a non-not-found error', async () => {
    const probeProvider = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'not_found' })
      .mockResolvedValueOnce({ kind: 'error', error: 'provider_unavailable' })

    const engine = createCarrierDetectionEngine({
      policy: createCarrierDetectionPolicy(),
      probeProvider,
      log: vi.fn(),
    })

    const result = await engine.detectCarrier({
      tenantId: 'tenant-a',
      containerNumber: 'MSCU1234567',
    })

    expect(result).toEqual({
      detected: false,
      provider: null,
      attemptedProviders: ['msc', 'maersk'],
      reason: 'provider_error',
      error: 'provider_unavailable',
    })
    expect(probeProvider).toHaveBeenCalledTimes(2)
  })

  it('enforces the maximum detections per container per hour', async () => {
    const now = 0
    const engine = createCarrierDetectionEngine({
      policy: createCarrierDetectionPolicy({
        nowMs: () => now,
      }),
      probeProvider: vi.fn(async () => ({ kind: 'not_found' as const })),
      nowMs: () => now,
      log: vi.fn(),
    })

    await engine.detectCarrier({
      tenantId: 'tenant-a',
      containerNumber: 'MSCU1234567',
    })
    await engine.detectCarrier({
      tenantId: 'tenant-a',
      containerNumber: 'MSCU1234567',
    })
    const result = await engine.detectCarrier({
      tenantId: 'tenant-a',
      containerNumber: 'MSCU1234567',
    })

    expect(result).toEqual({
      detected: false,
      provider: null,
      attemptedProviders: [],
      reason: 'rate_limited',
      error: 'carrier_detection_rate_limited',
    })
  })
})
