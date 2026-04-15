import { AgentControlApp } from '@agent/electron/renderer/AgentControlApp'
import '@agent/renderer/styles.css'
import { render } from 'solid-js/web'

const root = document.getElementById('app')
if (root) {
  render(() => <AgentControlApp />, root)
}
