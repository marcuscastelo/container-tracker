import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

const runSupervisorFileUrl = new URL('../installer/run-supervisor.ps1', import.meta.url)
const agentTrayHostFileUrl = new URL('../installer/agent-tray-host.ps1', import.meta.url)
const startupLauncherEntryFileUrl = new URL(
  '../installer/ct-agent-startup.entry.ts',
  import.meta.url,
)
const startupLauncherLibFileUrl = new URL('../installer/ct-agent-startup.lib.ts', import.meta.url)
const startupFileUrl = new URL('../platform/windows/startup.ts', import.meta.url)
const installerFileUrl = new URL('../installer/installer.iss', import.meta.url)
const rebuildReinstallFileUrl = new URL('../rebuild-reinstall.ps1', import.meta.url)
const winswServiceFileUrl = new URL('../installer/ContainerTrackerAgent.xml', import.meta.url)
const startupLauncherBuilderFileUrl = new URL(
  '../../../../scripts/agent/build-windows-startup-launcher.mjs',
  import.meta.url,
)

describe('windows supervisor launcher', () => {
  it('runs the supervisor entrypoint through the alias loader instead of the runtime shim', () => {
    const content = fs.readFileSync(runSupervisorFileUrl, 'utf8')

    expect(content).toContain('register-alias-loader.js')
    expect(content).toContain('supervisor.js')
    expect(content).toContain('launcher context pid=')
    expect(content).toContain('Write-PathProbe')
    expect(content).toContain('launch command:')
    expect(content).toContain('non-zero supervisor exit detected')
    expect(content).not.toContain('app\\dist\\agent.js')
    expect(content).not.toContain('agent-tray-host.ps1')
  })

  it('keeps the SEA startup launcher minimal and delegated to startup.js', () => {
    const entryContent = fs.readFileSync(startupLauncherEntryFileUrl, 'utf8')
    const libContent = fs.readFileSync(startupLauncherLibFileUrl, 'utf8')

    expect(entryContent).toContain('launchWindowsStartupLauncher')
    expect(entryContent).toContain('@agent/installer/ct-agent-startup.lib')
    expect(libContent).toContain('process.execPath')
    expect(libContent).toContain('CT_AGENT_INSTALL_ROOT')
    expect(libContent).toContain("path.win32.join(installRoot, 'node', 'node.exe')")
    expect(libContent).toContain("'platform'")
    expect(libContent).toContain("'windows'")
    expect(libContent).toContain("'startup.js'")
    expect(libContent).toContain('register-alias-loader.js')
    expect(libContent).toContain('windowsHide: true')
    expect(libContent).not.toContain('release-state.json')
    expect(libContent).not.toContain('agent-tray-host.ps1')
  })

  it('builds the startup launcher through SEA and postject instead of a C compiler', () => {
    const content = fs.readFileSync(startupLauncherBuilderFileUrl, 'utf8')

    expect(content).toContain("'esbuild'")
    expect(content).toContain('NODE_SEA_BLOB')
    expect(content).toContain('--experimental-sea-config')
    expect(content).toContain('postject')
    expect(content).toContain('ct-agent-startup.exe')
    expect(content).not.toContain('x86_64-w64-mingw32-gcc')
    expect(content).not.toContain("['-municode'")
  })

  it('starts supervisor and tray from the TypeScript Windows startup bootstrap', () => {
    const content = fs.readFileSync(startupFileUrl, 'utf8')

    expect(content).toContain('resolveWindowsPlatformPaths')
    expect(content).toContain('supervisor.pid')
    expect(content).toContain('CT_AGENT_UI_MODE')
    expect(content).toContain('tray')
    expect(content).not.toContain('schtasks')
  })

  it('registers HKCU Run and starts the native Windows startup launcher', () => {
    const content = fs.readFileSync(installerFileUrl, 'utf8')

    expect(content).toContain('Software\\Microsoft\\Windows\\CurrentVersion\\Run')
    expect(content).toContain('ValueName: "{#AgentRunValueName}"')
    expect(content).toContain('"{app}\\ct-agent-startup.exe"')
    expect(content).toContain('Source: "{#ReleaseRoot}\\ct-agent-startup.exe"')
    expect(content).toContain('Source: "{#ReleaseRoot}\\control-ui\\*"')
    expect(content).toContain('Source: "{#ReleaseRoot}\\electron\\*"')
    expect(content).toContain('Source: "run-supervisor.ps1"')
    expect(content).toContain('{app}\\app\\dist\\run-supervisor.ps1')
    expect(content).toContain('Starting agent startup launcher.')
    expect(content).not.toContain('Filename: "schtasks.exe"')
    expect(content).not.toContain('/Create /F /SC ONLOGON /IT /RL LIMITED')
    expect(content).not.toContain('Starting agent supervisor task.')
    expect(content).not.toContain('Starting agent tray host.')
    expect(content).not.toContain('{app}\\app\\dist\\agent-tray-host.ps1')
    expect(content).not.toContain("New-ScheduledTaskAction -Execute 'cmd.exe'")
    expect(content).not.toContain("New-ScheduledTaskAction -Execute 'powershell.exe'")
    expect(content).not.toContain('Starting agent runtime process.')
  })

  it('starts the native startup launcher from the rebuild-restart Windows flow', () => {
    const content = fs.readFileSync(rebuildReinstallFileUrl, 'utf8')

    expect(content).toContain('Start-AgentStartupLauncher')
    expect(content).toContain('ct-agent-startup.exe')
    expect(content).toContain('[agent:rebuild-restart] starting startup launcher:')
    expect(content).not.toContain('agent-startup-launcher:build')
    expect(content).not.toContain('Invoke-SafeTaskRun')
    expect(content).not.toContain('agent-tray-host.ps1')
  })

  it('keeps the legacy PowerShell tray out of the installer startup path', () => {
    const installerContent = fs.readFileSync(installerFileUrl, 'utf8')
    const content = fs.readFileSync(agentTrayHostFileUrl, 'utf8')

    expect(content).toContain("$agentTaskName = 'ContainerTrackerAgent'")
    expect(content).toContain('schtasks.exe')
    expect(content).toContain('Abrir terminal (logs ao vivo)')
    expect(installerContent).not.toContain('agent-tray-host.ps1')
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
