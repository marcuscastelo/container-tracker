import { useParams, useSearchParams } from '@solidjs/router'
import { AgentDetailPage } from '~/modules/agent/ui/agent-detail-page'

export default function AgentDetailRoute() {
  const params = useParams<{ id: string }>()
  const [search] = useSearchParams<{ logs?: string }>()
  return <AgentDetailPage agentId={params.id} initialOpenLogs={search.logs === '1'} />
}
