import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import {
  toContainerWithTrackingFallback,
  toContainerWithTrackingResponse,
} from '~/modules/process/interface/http/process.http.mappers'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import {
  buildShipmentAlertIncidentsReadModel,
  type ShipmentAlertIncidentsReadModel,
} from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  type ContainerSyncRecord,
  createContainerSyncMetadataFallback,
} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { Instant } from '~/shared/time/instant'
import { normalizeContainerNumber } from '~/shared/utils/normalizeContainerNumber'

type ProcessTrackingDeps = Pick<
  TrackingUseCases,
  'getContainerSummary' | 'getContainersSyncMetadata'
> &
  Partial<Pick<TrackingUseCases, 'findContainersLeanTrackingProjection'>>

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

async function resolveLegacyProcessDetailTracking(
  processWithContainers: ProcessWithContainers,
  deps: ProcessTrackingDeps,
  now: Instant,
  podLocationCode: string | null,
): Promise<Omit<ProcessTrackingResult, 'containersSync'>> {
  const trackingResults = await Promise.all(
    processWithContainers.containers.map(async (container) => {
      try {
        const summary = await deps.getContainerSummary(
          String(container.id),
          String(container.containerNumber),
          podLocationCode,
          now,
          { includeAcknowledgedAlerts: false },
        )
        const timeline = deriveTimelineWithSeriesReadModel(
          toTrackingObservationProjections(summary.observations),
          now,
          { includeSeriesHistory: false },
        )
        return {
          container: toContainerWithTrackingResponse(container, {
            status: summary.status,
            timeline,
          }),
          alerts: summary.alerts,
          operational: summary.operational,
        }
      } catch (err) {
        console.error(`Failed to get tracking summary for container ${String(container.id)}:`, err)
        return {
          container: toContainerWithTrackingFallback(container),
          alerts: [],
          operational: createTrackingOperationalSummaryFallback(true),
        }
      }
    }),
  )

  const operationalByContainerId = new Map<string, TrackingOperationalSummary>()
  for (const resultItem of trackingResults) {
    operationalByContainerId.set(resultItem.container.id, resultItem.operational)
  }

  const activeAlertIncidents = buildShipmentAlertIncidentsReadModel({
    containers: trackingResults.map((resultItem) => ({
      containerId: resultItem.container.id,
      containerNumber: resultItem.container.container_number,
      alerts: resultItem.alerts,
    })),
  })

  return {
    containersWithTracking: trackingResults.map((resultItem) => resultItem.container),
    activeAlerts: trackingResults.flatMap((resultItem) => resultItem.alerts),
    activeAlertIncidents,
    operationalByContainerId,
  }
}

export async function resolveProcessDetailTracking(
  processWithContainers: ProcessWithContainers,
  deps: ProcessTrackingDeps,
  now: Instant,
): Promise<ProcessTrackingResult> {
  const podLocationCode = extractPodLocationCode(processWithContainers.process.destination)
  const containersSyncPromise = resolveContainerSyncMetadata(processWithContainers, deps)

  if (deps.findContainersLeanTrackingProjection === undefined) {
    const legacy = await resolveLegacyProcessDetailTracking(
      processWithContainers,
      deps,
      now,
      podLocationCode,
    )
    return {
      ...legacy,
      containersSync: await containersSyncPromise,
    }
  }

  try {
    const [containersSync, trackingProjection] = await Promise.all([
      containersSyncPromise,
      deps.findContainersLeanTrackingProjection({
        containers: processWithContainers.containers.map((container) => ({
          containerId: String(container.id),
          containerNumber: String(container.containerNumber),
          ...(podLocationCode === null ? {} : { podLocationCode }),
        })),
        now,
      }),
    ])

    const operationalByContainerId = new Map<string, TrackingOperationalSummary>()
    for (const container of trackingProjection.containers) {
      operationalByContainerId.set(container.containerId, container.operational)
    }

    const containersWithTracking = processWithContainers.containers.map((container) => {
      const trackingContainer = trackingProjection.containers.find(
        (item) => item.containerId === String(container.id),
      )

      if (trackingContainer === undefined) {
        return toContainerWithTrackingFallback(container)
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
  } catch (error) {
    console.error('Failed to resolve lean process detail tracking projection:', error)
    const legacy = await resolveLegacyProcessDetailTracking(
      processWithContainers,
      deps,
      now,
      podLocationCode,
    )
    return {
      ...legacy,
      containersSync: await containersSyncPromise,
    }
  }
}
