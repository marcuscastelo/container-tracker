import type { SyncScope } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'
import type {
  SyncTargetContainerRecord,
  SyncTargetReadPort,
} from '~/capabilities/sync/application/ports/sync-target-read.port'
import { HttpError } from '~/shared/errors/httpErrors'

export type ResolvedSyncTarget = {
  readonly processId: string | null
  readonly containerNumber: string
  readonly provider: SupportedSyncProvider
}

type SyncTargetResolverService = {
  readonly resolveTargets: (scope: SyncScope) => Promise<readonly ResolvedSyncTarget[]>
}

const PROVIDER_BY_CARRIER: Readonly<Record<string, SupportedSyncProvider>> = {
  msc: 'msc',
  maersk: 'maersk',
  cmacgm: 'cmacgm',
  pil: 'pil',
}

function normalizeCarrierCode(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]/g, '')
}

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function toSupportedProvider(carrierCode: string | null): SupportedSyncProvider | null {
  if (!carrierCode) return null
  return PROVIDER_BY_CARRIER[normalizeCarrierCode(carrierCode)] ?? null
}

function toResolvedTarget(command: {
  readonly container: SyncTargetContainerRecord
  readonly unsupportedErrorPrefix: string
}): ResolvedSyncTarget {
  const containerNumber = normalizeContainerNumber(command.container.containerNumber)
  if (containerNumber.length === 0) {
    throw new HttpError('invalid_container_number_for_sync', 422)
  }

  const provider = toSupportedProvider(command.container.carrierCode)
  if (provider === null) {
    const carrierCode = command.container.carrierCode ?? 'null'
    throw new HttpError(`${command.unsupportedErrorPrefix}:${containerNumber}:${carrierCode}`, 422)
  }

  return {
    processId: command.container.processId,
    containerNumber,
    provider,
  }
}

function dedupeTargets(targets: readonly ResolvedSyncTarget[]): readonly ResolvedSyncTarget[] {
  const byKey = new Map<string, ResolvedSyncTarget>()

  for (const target of targets) {
    const key = `${target.provider}:${target.containerNumber}`
    if (!byKey.has(key)) {
      byKey.set(key, target)
    }
  }

  return Array.from(byKey.values())
}

async function resolveDashboardTargets(
  port: SyncTargetReadPort,
): Promise<readonly ResolvedSyncTarget[]> {
  const processIds = await port.listActiveProcessIds()
  if (processIds.length === 0) return []

  const { containersByProcessId } = await port.listContainersByProcessIds({ processIds })
  const targets: ResolvedSyncTarget[] = []

  for (const processId of processIds) {
    const containers = containersByProcessId.get(processId) ?? []
    for (const container of containers) {
      targets.push(
        toResolvedTarget({
          container,
          unsupportedErrorPrefix: 'unsupported_sync_provider_for_container',
        }),
      )
    }
  }

  return dedupeTargets(targets)
}

async function resolveProcessTargets(
  port: SyncTargetReadPort,
  processIdRaw: string,
): Promise<readonly ResolvedSyncTarget[]> {
  const processId = processIdRaw.trim()
  if (processId.length === 0) {
    throw new HttpError('process_id_required_for_sync', 400)
  }

  const process = await port.fetchProcessById({ processId })
  if (!process) {
    throw new HttpError('process_not_found', 404)
  }

  const { containers } = await port.listContainersByProcessId({ processId })
  const targets = containers.map((container) =>
    toResolvedTarget({
      container,
      unsupportedErrorPrefix: `unsupported_sync_provider_for_process:${processId}`,
    }),
  )

  return dedupeTargets(targets)
}

async function resolveContainerTargets(
  port: SyncTargetReadPort,
  containerNumberRaw: string,
): Promise<readonly ResolvedSyncTarget[]> {
  const containerNumber = normalizeContainerNumber(containerNumberRaw)
  if (containerNumber.length === 0) {
    throw new HttpError('container_number_required_for_sync', 400)
  }

  const { containers } = await port.findContainersByNumber({ containerNumber })
  if (containers.length === 0) {
    throw new HttpError('container_not_found', 404)
  }

  const targets = containers.map((container) =>
    toResolvedTarget({
      container,
      unsupportedErrorPrefix: 'unsupported_sync_provider_for_container',
    }),
  )

  const dedupedTargets = dedupeTargets(targets)
  const providers = new Set(dedupedTargets.map((target) => target.provider))

  if (providers.size > 1) {
    throw new HttpError(`ambiguous_sync_provider_for_container:${containerNumber}`, 409)
  }

  return dedupedTargets
}

export function createSyncTargetResolverService(deps: {
  readonly targetReadPort: SyncTargetReadPort
}): SyncTargetResolverService {
  return {
    async resolveTargets(scope) {
      if (scope.kind === 'dashboard') {
        return resolveDashboardTargets(deps.targetReadPort)
      }

      if (scope.kind === 'process') {
        return resolveProcessTargets(deps.targetReadPort, scope.processId)
      }

      return resolveContainerTargets(deps.targetReadPort, scope.containerNumber)
    },
  }
}

export type { SyncTargetResolverService }
