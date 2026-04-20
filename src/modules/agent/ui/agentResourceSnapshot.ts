import type { fetchAgentDetail, fetchAgentList } from '~/modules/agent/ui/api/agent.api'
import { type ResourceSnapshotLike, readResourceSnapshot } from '~/shared/solid/resourceSnapshot'

export function readAgentListResponseSnapshot(
  resource: ResourceSnapshotLike<Awaited<ReturnType<typeof fetchAgentList>> | undefined>,
): Awaited<ReturnType<typeof fetchAgentList>> | undefined {
  return readResourceSnapshot(resource)
}

export function readAgentDetailSnapshot(
  resource: ResourceSnapshotLike<Awaited<ReturnType<typeof fetchAgentDetail>> | undefined>,
): Awaited<ReturnType<typeof fetchAgentDetail>> | undefined {
  return readResourceSnapshot(resource)
}
