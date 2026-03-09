import { useParams } from '@solidjs/router'
import { AgentDetailPage } from '~/modules/agent/ui/agent-detail-page'

export default function AgentDetailRoute() {
  const params = useParams<{ id: string }>()
  return <AgentDetailPage agentId={params.id} />
}
