import fs from 'node:fs'

import { collectInstallerTaskRegistrationErrors } from '@agent/build-release'
import { describe, expect, it } from 'vitest'

const installerFileUrl = new URL('../installer/installer.iss', import.meta.url)

describe('build-release preflight task registration validation', () => {
  it('accepts the current PowerShell Register-ScheduledTask installer flow', () => {
    const installerContent = fs.readFileSync(installerFileUrl, 'utf8')

    expect(collectInstallerTaskRegistrationErrors(installerContent)).toEqual([])
  })

  it('accepts legacy schtasks /Create registrations', () => {
    const installerContent = `
Filename: "schtasks.exe"; Parameters: "/Create /SC ONLOGON /IT /RL LIMITED /TN ""ContainerTrackerAgent"" /TR ""powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\run-supervisor.ps1"""""""
Filename: "schtasks.exe"; Parameters: "/Create /SC ONLOGON /IT /RL LIMITED /TN ""ContainerTrackerAgentUpdater"" /TR ""powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\updater-hidden.ps1"""""""
`.trim()

    expect(collectInstallerTaskRegistrationErrors(installerContent)).toEqual([])
  })

  it('rejects installers without two task registration commands', () => {
    const installerContent = `
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$taskName = '{#AgentTaskName}'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /s /c powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\run-supervisor.ps1""""'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null"""
`.trim()

    expect(collectInstallerTaskRegistrationErrors(installerContent)).toContain(
      'installer.iss must include two ONLOGON task registration commands',
    )
  })

  it('rejects agent task registrations that still point to the tray host', () => {
    const installerContent = `
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$taskName = '{#AgentTaskName}'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /s /c powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\agent-tray-host.ps1""""'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null"""
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$taskName = '{#UpdaterTaskName}'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /s /c powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\\app\\dist\\updater-hidden.ps1""""'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null"""
`.trim()

    expect(collectInstallerTaskRegistrationErrors(installerContent)).toContain(
      'installer.iss agent task must launch run-supervisor.ps1 instead of agent-tray-host.ps1',
    )
  })
})
