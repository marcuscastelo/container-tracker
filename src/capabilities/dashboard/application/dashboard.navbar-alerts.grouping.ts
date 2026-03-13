import type {
  MutableContainerAccumulator,
  MutableProcessAccumulator,
  ProcessContext,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.shared'
import { toRouteSummary } from '~/capabilities/dashboard/application/dashboard.navbar-alerts.sorting'
import type {
  DashboardContainerRecordProjection,
  DashboardProcessWithOperationalSummaryProjection,
} from '~/capabilities/dashboard/application/dashboard.processes.projection'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'

export function indexProcessContextById(
  processes: readonly DashboardProcessWithOperationalSummaryProjection[],
): ReadonlyMap<string, ProcessContext> {
  const contextByProcessId = new Map<string, ProcessContext>()

  for (const processWithSummary of processes) {
    const processId = processWithSummary.pwc.process.id
    const containersById = new Map<string, DashboardContainerRecordProjection>()
    for (const container of processWithSummary.pwc.containers) {
      containersById.set(container.id, container)
    }

    contextByProcessId.set(processId, {
      process: processWithSummary.pwc.process,
      containersById,
    })
  }

  return contextByProcessId
}

export function resolveCarrier(
  process: DashboardProcessWithOperationalSummaryProjection['pwc']['process'] | undefined,
): string | null {
  if (!process || !('carrier' in process)) return null
  const carrier = process.carrier
  if (typeof carrier !== 'string') return null
  const normalizedCarrier = carrier.trim()
  return normalizedCarrier.length > 0 ? normalizedCarrier : null
}

export function toContainerSummaryCommand(
  alerts: readonly TrackingActiveAlertReadModel[],
  contextByProcessId: ReadonlyMap<string, ProcessContext>,
): readonly {
  readonly containerId: string
  readonly containerNumber: string
  readonly podLocationCode: string | null
}[] {
  const dedupedByContainerId = new Map<
    string,
    {
      readonly containerId: string
      readonly containerNumber: string
      readonly podLocationCode: string | null
    }
  >()

  for (const alert of alerts) {
    if (dedupedByContainerId.has(alert.container_id)) continue

    const context = contextByProcessId.get(alert.process_id)
    const containerNumber = context?.containersById.get(alert.container_id)?.containerNumber
    if (!containerNumber) continue

    dedupedByContainerId.set(alert.container_id, {
      containerId: alert.container_id,
      containerNumber,
      podLocationCode: null,
    })
  }

  return [...dedupedByContainerId.values()]
}

export function upsertProcessAccumulator(
  processAccumulatorsById: Map<string, MutableProcessAccumulator>,
  params: {
    readonly alert: TrackingActiveAlertReadModel
    readonly context: ProcessContext | undefined
  },
): MutableProcessAccumulator {
  const existing = processAccumulatorsById.get(params.alert.process_id)
  if (existing) return existing

  const process = params.context?.process
  const created: MutableProcessAccumulator = {
    processId: params.alert.process_id,
    processReference: process?.reference ?? null,
    carrier: resolveCarrier(process),
    routeSummary: toRouteSummary(process?.origin ?? null, process?.destination ?? null),
    containersById: new Map(),
  }
  processAccumulatorsById.set(params.alert.process_id, created)
  return created
}

export function upsertContainerAccumulator(params: {
  readonly processAccumulator: MutableProcessAccumulator
  readonly alert: TrackingActiveAlertReadModel
  readonly context: ProcessContext | undefined
  readonly status: string | null
  readonly eta: string | null
}): MutableContainerAccumulator {
  const existing = params.processAccumulator.containersById.get(params.alert.container_id)
  if (existing) return existing

  const containerFromContext = params.context?.containersById.get(params.alert.container_id)
  const created: MutableContainerAccumulator = {
    containerId: params.alert.container_id,
    containerNumber: containerFromContext?.containerNumber ?? params.alert.container_id,
    status: params.status,
    eta: params.eta,
    alerts: [],
  }
  params.processAccumulator.containersById.set(params.alert.container_id, created)
  return created
}
