import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import { toContainerWithTrackingResponse } from '~/modules/process/interface/http/process.http.mappers'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { ShipmentAlertIncidentsReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  type ContainerSyncRecord,
  createContainerSyncMetadataFallback,
} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Instant } from '~/shared/time/instant'
import { normalizeContainerNumber } from '~/shared/utils/normalizeContainerNumber'

type ProcessTrackingDeps = Pick<
  TrackingUseCases,
  'findContainersHotReadProjection' | 'getContainersSyncMetadata'
>

type ProcessTrackingResult = {
  readonly containersWithTracking: readonly ReturnType<typeof toContainerWithTrackingResponse>[]
  readonly activeAlerts: readonly TrackingAlert[]
  readonly activeAlertIncidents: ShipmentAlertIncidentsReadModel
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
  now: Instant,
): Promise<ProcessTrackingResult> {
  const podLocationCode = extractPodLocationCode(processWithContainers.process.destination)
  const containersSyncPromise = resolveContainerSyncMetadata(processWithContainers, deps)
  const [containersSync, trackingProjection] = await Promise.all([
    containersSyncPromise,
    deps.findContainersHotReadProjection({
      containers: processWithContainers.containers.map((container) => ({
        containerId: String(container.id),
        containerNumber: String(container.containerNumber),
        ...(podLocationCode === null ? {} : { podLocationCode }),
      })),
      now,
    }),
  ])

  const trackingByContainerId = new Map(
    trackingProjection.containers.map((container) => [container.containerId, container] as const),
  )
  const operationalByContainerId = new Map<string, TrackingOperationalSummary>()
  for (const container of trackingProjection.containers) {
    operationalByContainerId.set(container.containerId, container.operational)
  }

  const containersWithTracking = processWithContainers.containers.map((container) => {
    const trackingContainer = trackingByContainerId.get(String(container.id))

    if (trackingContainer === undefined) {
      throw new Error(
        `tracking.findContainersHotReadProjection missing detail container ${String(container.id)}`,
      )
    }

    return toContainerWithTrackingResponse(container, {
      status: trackingContainer.status,
      timeline: trackingContainer.timeline,
    })
  })

  return {
    containersWithTracking,
    activeAlerts: trackingProjection.activeAlerts,
    activeAlertIncidents: trackingProjection.activeAlertIncidents,
    operationalByContainerId,
    containersSync,
  }
}
