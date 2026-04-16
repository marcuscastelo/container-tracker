import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

const runSupervisorFileUrl = new URL('../installer/run-supervisor.ps1', import.meta.url)
const agentTrayHostFileUrl = new URL('../installer/agent-tray-host.ps1', import.meta.url)
const installerFileUrl = new URL('../installer/installer.iss', import.meta.url)
const rebuildReinstallFileUrl = new URL('../rebuild-reinstall.ps1', import.meta.url)
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
    expect(content).toContain('Starting agent tray host.')
    expect(content).toContain('{app}\\app\\dist\\agent-tray-host.ps1')
    expect(content).not.toContain('Starting agent runtime process.')
  })

  it('starts the tray host from the rebuild-restart Windows flow', () => {
    const content = fs.readFileSync(rebuildReinstallFileUrl, 'utf8')

    expect(content).toContain('Start-AgentTrayHost')
    expect(content).toContain('agent-tray-host.ps1')
    expect(content).toContain('[agent:rebuild-restart] starting tray host:')
  })

  it('keeps the tray host task-backed instead of launching the runtime directly', () => {
    const content = fs.readFileSync(agentTrayHostFileUrl, 'utf8')

    expect(content).toContain("$agentTaskName = 'ContainerTrackerAgent'")
    expect(content).toContain('schtasks.exe')
    expect(content).not.toContain('$agentScriptPath')
    expect(content).not.toContain('Stop-AgentNodeProcesses')
    expect(content).not.toContain("Join-Path $installRoot 'app\\dist\\agent.js'")
  })

  it('keeps the optional WinSW service definition aligned with the installed agent shim', () => {
    const content = fs.readFileSync(winswServiceFileUrl, 'utf8')

    expect(content).toContain('app\\dist\\agent.js')
    expect(content).not.toContain('register-alias-loader.js')
  })
})
