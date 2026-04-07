import { AgentControlApp } from '@tools/agent-control-ui/renderer/AgentControlApp'
import { render } from 'solid-js/web'

const root = document.getElementById('app')
if (root) {
  render(() => <AgentControlApp />, root)
}
