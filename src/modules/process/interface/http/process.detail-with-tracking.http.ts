import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import {
  toContainerWithTrackingFallback,
  toContainerWithTrackingResponse,
} from '~/modules/process/interface/http/process.http.mappers'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type { GetContainerSummaryResult } from '~/modules/tracking/application/usecases/get-container-summary.usecase'
import {
  type ContainerSyncRecord,
  createContainerSyncMetadataFallback,
} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { normalizeContainerNumber } from '~/shared/utils/normalizeContainerNumber'

type ProcessTrackingDeps = Pick<
  TrackingUseCases,
  'getContainerSummary' | 'getContainersSyncMetadata'
>

type ProcessTrackingResult = {
  readonly containersWithTracking: readonly ReturnType<typeof toContainerWithTrackingResponse>[]
  readonly allAlerts: readonly GetContainerSummaryResult['alerts'][number][]
  readonly operationalByContainerId: ReadonlyMap<string, TrackingOperationalSummary>
  readonly containersSync: readonly ContainerSyncRecord[]
}

function normalizeStructuredLocationCode(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{5}[A-Z0-9]{0,3}$/.test(normalized) ? normalized : null
}

function normalizeDirectDestinationCode(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  if (/^[A-Z]{5}$/.test(normalized)) return normalized

  // Free-text destination names are common; only accept suffixes when they contain digits
  // to avoid classifying generic city names (e.g. "SANTOS") as canonical POD codes.
  if (/^[A-Z]{5}[A-Z0-9]{2,3}$/.test(normalized) && /[0-9]/.test(normalized.slice(5))) {
    return normalized
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractPodLocationCode(destination: string | null | undefined): string | null {
  if (!destination) return null

  const directCode = normalizeDirectDestinationCode(destination)
  if (directCode) return directCode

  const trimmed = destination.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!isRecord(parsed)) return null

    const candidates: unknown[] = [
      parsed.destination_location_code,
      parsed.pod_location_code,
      parsed.destinationCode,
      parsed.code,
      parsed.unlocode,
      parsed.location_code,
    ]

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue
      const normalized = normalizeStructuredLocationCode(candidate)
      if (normalized) return normalized
    }

    return null
  } catch {
    return null
  }
}

async function resolveContainerSyncMetadata(
  processWithContainers: ProcessWithContainers,
  deps: ProcessTrackingDeps,
): Promise<readonly ContainerSyncRecord[]> {
  const containerNumbers = processWithContainers.containers.map((container) =>
    normalizeContainerNumber(String(container.containerNumber)),
  )

  let containersSync: readonly ContainerSyncRecord[] = containerNumbers.map((containerNumber) =>
    createContainerSyncMetadataFallback(containerNumber),
  )

  try {
    containersSync = await deps.getContainersSyncMetadata({
      containerNumbers,
    })
  } catch (err) {
    console.error('Failed to get container sync metadata:', err)
  }

  return containersSync
}

export async function resolveProcessDetailTracking(
  processWithContainers: ProcessWithContainers,
  deps: ProcessTrackingDeps,
  now: Date,
): Promise<ProcessTrackingResult> {
  // Destination can be a canonical code or a serialized location payload.
  // If we cannot extract a canonical POD code, tracking falls back safely.
  const podLocationCode = extractPodLocationCode(processWithContainers.process.destination)

  const [containersSync, trackingResults] = await Promise.all([
    resolveContainerSyncMetadata(processWithContainers, deps),
    Promise.all(
      processWithContainers.containers.map(async (container) => {
        try {
          const summary = await deps.getContainerSummary(
            String(container.id),
            String(container.containerNumber),
            podLocationCode,
            now,
            { includeAcknowledgedAlerts: true },
          )
          const timeline = deriveTimelineWithSeriesReadModel(
            toTrackingObservationProjections(summary.observations),
            now,
          )
          return {
            container: toContainerWithTrackingResponse(container, {
              status: summary.status,
              observations: summary.observations,
              timeline,
            }),
            alerts: summary.alerts,
            operational: summary.operational,
          }
        } catch (err) {
          console.error(
            `Failed to get tracking summary for container ${String(container.id)}:`,
            err,
          )
          return {
            container: toContainerWithTrackingFallback(container),
            alerts: [],
            operational: createTrackingOperationalSummaryFallback(true),
          }
        }
      }),
    ),
  ])

  const operationalByContainerId = new Map<string, TrackingOperationalSummary>()
  for (const resultItem of trackingResults) {
    operationalByContainerId.set(resultItem.container.id, resultItem.operational)
  }

  return {
    containersWithTracking: trackingResults.map((resultItem) => resultItem.container),
    allAlerts: trackingResults.flatMap((resultItem) => resultItem.alerts),
    operationalByContainerId,
    containersSync,
  }
}
