import { useLocation, useParams } from '@solidjs/router'
import { AgentDetailPage } from '~/modules/agent/ui/agent-detail-page'

function shouldOpenLogsFromNavigationState(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false
  return Reflect.get(state, 'openLogs') === true
}

export default function AgentDetailRoute() {
  const params = useParams<{ id: string }>()
  const location = useLocation()

  return (
    <AgentDetailPage
      agentId={params.id}
      initialOpenLogs={shouldOpenLogsFromNavigationState(location.state)}
    />
  )
}
