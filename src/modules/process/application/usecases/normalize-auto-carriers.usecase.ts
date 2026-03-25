import type { ProcessRepository } from '~/modules/process/application/process.repository'

type EffectiveCarrierSummary = 'UNKNOWN' | 'SINGLE' | 'MIXED'

export type NormalizeAutoCarriersResult = {
  readonly ok: true
  readonly process_id: string
  readonly normalized: boolean
  readonly reason: 'normalized' | 'no_changes_required' | 'target_carrier_not_resolved'
  readonly target_carrier_code: string | null
  readonly before_summary: EffectiveCarrierSummary
  readonly after_summary: EffectiveCarrierSummary
  readonly updated_auto_containers: number
  readonly skipped_manual_containers: number
  readonly already_aligned_auto_containers: number
}

type NormalizeAutoCarrierContainerRecord = {
  readonly id: string | number
  readonly carrierCode: string | null
  readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL' | undefined
}

type NormalizeAutoCarrierUpdateCommand = {
  readonly containerId: string
  readonly carrierCode: string | null
  readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL' | undefined
  readonly carrierDetectedAt?: string | null | undefined
  readonly carrierDetectionSource?:
    | 'process-seed'
    | 'auto-detect'
    | 'manual-user'
    | 'legacy-backfill'
    | null
    | undefined
}

function toNormalizedCarrierCode(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) return null
  if (normalized === 'unknown') return null
  return normalized
}

function toCarrierSummary(carrierCodes: readonly (string | null)[]): EffectiveCarrierSummary {
  const normalized = new Set<string>()

  for (const carrierCode of carrierCodes) {
    const candidate = toNormalizedCarrierCode(carrierCode)
    if (!candidate) continue
    normalized.add(candidate)
  }

  if (normalized.size === 0) return 'UNKNOWN'
  if (normalized.size === 1) return 'SINGLE'
  return 'MIXED'
}

function pickNormalizeTargetCarrier(command: {
  readonly processDefaultCarrier: string | null
  readonly containerCarrierCodes: readonly (string | null)[]
}): string | null {
  const byNormalized = new Map<string, { count: number; original: string }>()

  for (const carrierCode of command.containerCarrierCodes) {
    if (!carrierCode) continue
    const normalized = toNormalizedCarrierCode(carrierCode)
    if (!normalized) continue

    const existing = byNormalized.get(normalized)
    if (existing) {
      byNormalized.set(normalized, {
        count: existing.count + 1,
        original: existing.original,
      })
      continue
    }

    byNormalized.set(normalized, {
      count: 1,
      original: carrierCode,
    })
  }

  if (byNormalized.size === 0) return null

  const normalizedDefault = toNormalizedCarrierCode(command.processDefaultCarrier)
  if (normalizedDefault) {
    const fromDefault = byNormalized.get(normalizedDefault)
    if (fromDefault) return fromDefault.original
  }

  const sorted = Array.from(byNormalized.values()).sort((left, right) => right.count - left.count)
  const best = sorted[0]
  const second = sorted[1]

  if (!best) return null
  if (second && second.count === best.count) return null
  return best.original
}

export function createNormalizeAutoCarriersUseCase(deps: {
  readonly repository: ProcessRepository
  readonly containerUseCases: {
    readonly listByProcessId: (command: { readonly processId: string }) => Promise<{
      readonly containers: readonly NormalizeAutoCarrierContainerRecord[]
    }>
    readonly updateCarrier: (command: NormalizeAutoCarrierUpdateCommand) => Promise<unknown>
  }
}) {
  return async function execute(command: {
    readonly processId: string
  }): Promise<NormalizeAutoCarriersResult | null> {
    const processId = command.processId.trim()
    if (processId.length === 0) return null

    const process = await deps.repository.fetchById(processId)
    if (!process) return null

    const processContainers = await deps.containerUseCases.listByProcessId({ processId })
    const beforeSummary = toCarrierSummary(
      processContainers.containers.map((container) => container.carrierCode),
    )
    const targetCarrierCode = pickNormalizeTargetCarrier({
      processDefaultCarrier: process.defaultCarrierCode ?? null,
      containerCarrierCodes: processContainers.containers.map((container) => container.carrierCode),
    })

    if (!targetCarrierCode) {
      return {
        ok: true,
        process_id: processId,
        normalized: false,
        reason: 'target_carrier_not_resolved',
        target_carrier_code: null,
        before_summary: beforeSummary,
        after_summary: beforeSummary,
        updated_auto_containers: 0,
        skipped_manual_containers: processContainers.containers.filter(
          (container) => container.carrierAssignmentMode === 'MANUAL',
        ).length,
        already_aligned_auto_containers: processContainers.containers.filter(
          (container) => container.carrierAssignmentMode !== 'MANUAL',
        ).length,
      }
    }

    const nowIso = new Date().toISOString()
    let updatedAutoContainers = 0
    let skippedManualContainers = 0
    let alreadyAlignedAutoContainers = 0

    for (const container of processContainers.containers) {
      if (container.carrierAssignmentMode === 'MANUAL') {
        skippedManualContainers += 1
        continue
      }

      const currentCarrier = toNormalizedCarrierCode(container.carrierCode)
      const targetCarrier = toNormalizedCarrierCode(targetCarrierCode)
      if (currentCarrier && targetCarrier && currentCarrier === targetCarrier) {
        alreadyAlignedAutoContainers += 1
        continue
      }

      await deps.containerUseCases.updateCarrier({
        containerId: String(container.id),
        carrierCode: targetCarrierCode,
        carrierAssignmentMode: 'AUTO',
        carrierDetectedAt: nowIso,
        carrierDetectionSource: 'manual-user',
      })
      updatedAutoContainers += 1
    }

    if (process.carrierMode === 'AUTO') {
      await deps.repository.update(processId, {
        carrier_mode: 'AUTO',
        default_carrier_code: targetCarrierCode,
        last_resolved_carrier_code: targetCarrierCode,
        carrier_resolved_at: nowIso,
        carrier: targetCarrierCode,
      })
    }

    const afterContainers = await deps.containerUseCases.listByProcessId({ processId })
    const afterSummary = toCarrierSummary(
      afterContainers.containers.map((container) => container.carrierCode),
    )

    return {
      ok: true,
      process_id: processId,
      normalized: updatedAutoContainers > 0,
      reason: updatedAutoContainers > 0 ? 'normalized' : 'no_changes_required',
      target_carrier_code: targetCarrierCode,
      before_summary: beforeSummary,
      after_summary: afterSummary,
      updated_auto_containers: updatedAutoContainers,
      skipped_manual_containers: skippedManualContainers,
      already_aligned_auto_containers: alreadyAlignedAutoContainers,
    }
  }
}
