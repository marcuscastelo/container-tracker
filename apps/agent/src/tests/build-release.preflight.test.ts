import fs from 'node:fs'

import { collectInstallerStartupRegistrationErrors } from '@agent/build-release'
import { describe, expect, it } from 'vitest'

const installerFileUrl = new URL('../installer/installer.iss', import.meta.url)

describe('build-release preflight startup registration validation', () => {
  it('accepts the current HKCU Run startup installer flow', () => {
    const installerContent = fs.readFileSync(installerFileUrl, 'utf8')

    expect(collectInstallerStartupRegistrationErrors(installerContent)).toEqual([])
  })

  it('rejects legacy schtasks /Create registrations', () => {
    const installerContent = `
Root: HKCU; Subkey: "Software\\Microsoft\\Windows\\CurrentVersion\\Run"; ValueType: string; ValueName: "{#AgentRunValueName}"; ValueData: """{app}\\ct-agent-startup.exe"""
Filename: "schtasks.exe"; Parameters: "/Create /SC ONLOGON /IT /RL LIMITED /TN ""ContainerTrackerAgent"" /TR ""powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\run-supervisor.ps1"""""""
`.trim()

    expect(collectInstallerStartupRegistrationErrors(installerContent)).toContain(
      'installer.iss must not register Windows Scheduled Tasks for startup',
    )
  })

  it('rejects installers without an HKCU Run registration', () => {
    const installerContent = `
Filename: "cmd.exe"; Parameters: "/C echo Installer completed"
`.trim()

    expect(collectInstallerStartupRegistrationErrors(installerContent)).toContain(
      'installer.iss must register HKCU Run startup for ct-agent-startup.exe',
    )
  })

  it('rejects agent task registrations that still point to the tray host', () => {
    const installerContent = `
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$taskName = '{#AgentTaskName}'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /s /c powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\agent-tray-host.ps1""""'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null"""
`.trim()

    expect(collectInstallerStartupRegistrationErrors(installerContent)).toContain(
      'installer.iss must not install or launch the PowerShell tray host',
    )
  })

  it('rejects scheduled-task start or stop commands in the installer command sections', () => {
    const installerContent = `
Root: HKCU; Subkey: "Software\\Microsoft\\Windows\\CurrentVersion\\Run"; ValueType: string; ValueName: "{#AgentRunValueName}"; ValueData: """{app}\\ct-agent-startup.exe"""
Filename: "cmd.exe"; Parameters: "/C schtasks /Run /TN ""ContainerTrackerAgent"" || exit /B 0"
`.trim()

    expect(collectInstallerStartupRegistrationErrors(installerContent)).toContain(
      'installer.iss must not start or stop the agent through scheduled-task commands',
    )
  })
})
