import { AgentControlApp } from '@tools/agent/electron/renderer/AgentControlApp'
import { render } from 'solid-js/web'

const root = document.getElementById('app')
if (root) {
  render(() => <AgentControlApp />, root)
}
