import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

const runSupervisorFileUrl = new URL('../installer/run-supervisor.ps1', import.meta.url)
const agentTrayHostFileUrl = new URL('../installer/agent-tray-host.ps1', import.meta.url)
const installerFileUrl = new URL('../installer/installer.iss', import.meta.url)
const winswServiceFileUrl = new URL('../installer/ContainerTrackerAgent.xml', import.meta.url)

describe('windows supervisor launcher', () => {
  it('runs the supervisor entrypoint through the alias loader instead of the runtime shim', () => {
    const content = fs.readFileSync(runSupervisorFileUrl, 'utf8')

    expect(content).toContain('register-alias-loader.js')
    expect(content).toContain('supervisor.js')
    expect(content).not.toContain('app\\dist\\agent.js')
    expect(content).not.toContain('agent-tray-host.ps1')
  })

  it('registers and starts the Windows agent task through run-supervisor.ps1', () => {
    const content = fs.readFileSync(installerFileUrl, 'utf8')

    expect(content).toContain('Source: "run-supervisor.ps1"')
    expect(content).toContain('{app}\\app\\dist\\run-supervisor.ps1')
    expect(content).not.toContain('Starting agent runtime process.')
  })

  it('keeps the legacy tray host pointed at the runtime entrypoint instead of the supervisor shim', () => {
    const content = fs.readFileSync(agentTrayHostFileUrl, 'utf8')

    expect(content).toContain('register-alias-loader.js')
    expect(content).toContain('\\app\\dist\\tools\\agent\\supervisor.js')
    expect(content).toContain('app\\dist\\tools\\agent\\agent.js')
    expect(content).not.toContain("Join-Path $installRoot 'app\\dist\\agent.js'")
  })

  it('keeps the optional WinSW service definition aligned with the installed agent shim', () => {
    const content = fs.readFileSync(winswServiceFileUrl, 'utf8')

    expect(content).toContain('app\\dist\\agent.js')
    expect(content).not.toContain('register-alias-loader.js')
  })
})
