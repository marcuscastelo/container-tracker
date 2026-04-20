import type { AgentRunReason } from '@agent/agent.scheduler'
import type {
  SyncBackendClient,
  SyncTargetsResponse,
} from '@agent/sync/infrastructure/sync-backend.client'

export type PollWorkResult = {
  readonly targetsResponse: SyncTargetsResponse
  readonly recoveredOwnedLeases: boolean
}

export async function pollWork(command: {
  readonly backendClient: SyncBackendClient
  readonly reason: AgentRunReason
  readonly processed: number
  readonly limit: number
  readonly leaseBatchSize: number
  readonly onRecoveredOwnedLeases?: () => void
}): Promise<PollWorkResult> {
  const remaining = command.limit - command.processed
  const boundedLimit = Math.max(1, Math.min(command.leaseBatchSize, remaining))

  let targetsResponse = await command.backendClient.fetchTargets({
    limit: boundedLimit,
    recoverOwnedLeases: false,
  })

  if (
    targetsResponse.targets.length > 0 ||
    command.reason !== 'startup' ||
    command.processed !== 0
  ) {
    return {
      targetsResponse,
      recoveredOwnedLeases: false,
    }
  }

  targetsResponse = await command.backendClient.fetchTargets({
    limit: boundedLimit,
    recoverOwnedLeases: true,
  })

  const recoveredOwnedLeases = targetsResponse.targets.length > 0
  if (recoveredOwnedLeases) {
    command.onRecoveredOwnedLeases?.()
  }

  return {
    targetsResponse,
    recoveredOwnedLeases,
  }
}
