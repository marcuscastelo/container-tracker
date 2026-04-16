Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$logsDir = Join-Path $dataRoot 'logs'
$agentTaskName = 'ContainerTrackerAgent'
$supervisorLogPath = Join-Path $logsDir 'supervisor.log'
$agentOutLogPath = Join-Path $logsDir 'agent.out.log'
$agentErrLogPath = Join-Path $logsDir 'agent.err.log'

$script:lastKnownTaskStatus = 'Unknown'
$script:lastAgentStartUtc = $null
$script:lastAgentError = $null
$script:isShuttingDown = $false
$script:trayIconImage = $null

function Ensure-FileExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $parent = Split-Path -Path $Path -Parent
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }
}

function Invoke-ScheduledTaskCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$IgnoreFailure
  )

  $output = (& schtasks.exe @Arguments 2>&1 | Out-String)
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) {
    $exitCode = 0
  }

  if ($exitCode -ne 0 -and -not $IgnoreFailure) {
    throw "schtasks.exe $($Arguments -join ' ') failed with code ${exitCode}: $output"
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output   = $output
  }
}

function Get-AgentTaskSnapshot {
  $result = Invoke-ScheduledTaskCommand `
    -Arguments @('/Query', '/TN', $agentTaskName, '/V', '/FO', 'LIST') `
    -IgnoreFailure

  if ($result.ExitCode -ne 0) {
    return [pscustomobject]@{
      Status = 'Unavailable'
      Detail = $result.Output.Trim()
    }
  }

  $status = 'Unknown'
  foreach ($line in ($result.Output -split '\r?\n')) {
    if ($line -match '^Status:\s*(.+)$') {
      $status = $Matches[1].Trim()
      break
    }
  }

  return [pscustomobject]@{
    Status = $status
    Detail = $result.Output.Trim()
  }
}

function Start-AgentTask {
  Invoke-ScheduledTaskCommand -Arguments @('/Run', '/TN', $agentTaskName) | Out-Null
  $script:lastAgentStartUtc = [DateTime]::UtcNow
  $script:lastAgentError = $null
}

function Is-AgentRunning {
  $snapshot = Get-AgentTaskSnapshot
  $script:lastKnownTaskStatus = $snapshot.Status
  return $snapshot.Status -eq 'Running'
}

function Ensure-AgentRunning {
  if ($script:isShuttingDown) {
    return
  }

  if (Is-AgentRunning) {
    return
  }

  try {
    Start-AgentTask
  }
  catch {
    $script:lastAgentError = $_.Exception.Message
  }
}

function Restart-AgentTask {
  Invoke-ScheduledTaskCommand -Arguments @('/End', '/TN', $agentTaskName) -IgnoreFailure |
    Out-Null
  Start-Sleep -Milliseconds 500
  Start-AgentTask
}

function Open-LogFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  Ensure-FileExists -Path $Path
  Start-Process -FilePath 'notepad.exe' -ArgumentList @($Path) | Out-Null
}

function Get-AgentStatusText {
  $snapshot = Get-AgentTaskSnapshot
  $script:lastKnownTaskStatus = $snapshot.Status

  $lines = @(
    "Task: $agentTaskName",
    "Status: $($snapshot.Status)",
    "Log supervisor: $supervisorLogPath",
    "Log out: $agentOutLogPath",
    "Log err: $agentErrLogPath"
  )

  if ($null -ne $script:lastAgentStartUtc) {
    $lines += "Ultimo start UTC: $($script:lastAgentStartUtc.ToString('yyyy-MM-dd HH:mm:ss'))"
  }

  if ($script:lastAgentError) {
    $lines += "Ultimo erro: $($script:lastAgentError)"
  }

  if ($snapshot.Detail) {
    $lines += ''
    $lines += $snapshot.Detail
  }

  return ($lines -join [Environment]::NewLine)
}

function Set-NotifyText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Forms.NotifyIcon]$TrayIcon,
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $normalizedText = $Text
  if ($normalizedText.Length -gt 63) {
    $normalizedText = $normalizedText.Substring(0, 63)
  }

  $TrayIcon.Text = $normalizedText
}

function Update-StatusLabel {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Forms.ToolStripMenuItem]$StatusMenuItem,
    [Parameter(Mandatory = $true)]
    [System.Windows.Forms.NotifyIcon]$TrayIcon
  )

  $snapshot = Get-AgentTaskSnapshot
  $script:lastKnownTaskStatus = $snapshot.Status

  if ($snapshot.Status -eq 'Running') {
    $StatusMenuItem.Text = 'Status: ativo'
    Set-NotifyText -TrayIcon $TrayIcon -Text 'Container Tracker Agent - Ativo'
    return
  }

  if ($script:lastAgentError) {
    $StatusMenuItem.Text = 'Status: erro ao iniciar'
    Set-NotifyText -TrayIcon $TrayIcon -Text 'Container Tracker Agent - Erro'
    return
  }

  $StatusMenuItem.Text = "Status: $($snapshot.Status)"
  Set-NotifyText -TrayIcon $TrayIcon -Text "Container Tracker Agent - $($snapshot.Status)"
}

$mutexCreated = $false
$trayMutex = [System.Threading.Mutex]::new($true, 'ContainerTrackerAgentTrayHost', [ref]$mutexCreated)
if (-not $mutexCreated) {
  $trayMutex.Dispose()
  exit 0
}

$contextMenu = $null
$trayIcon = $null
$monitorTimer = $null

try {
  Ensure-FileExists -Path $supervisorLogPath
  Ensure-FileExists -Path $agentOutLogPath
  Ensure-FileExists -Path $agentErrLogPath

  Ensure-AgentRunning

  $contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

  $statusMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $statusMenuItem.Enabled = $false

  $showStatusMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $showStatusMenuItem.Text = 'Ver status'
  $null = $showStatusMenuItem.add_Click({
      [System.Windows.Forms.MessageBox]::Show(
        (Get-AgentStatusText),
        'Container Tracker Agent',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null
    })

  $openSupervisorLogMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $openSupervisorLogMenuItem.Text = 'Abrir log supervisor'
  $null = $openSupervisorLogMenuItem.add_Click({
      Open-LogFile -Path $supervisorLogPath
    })

  $openOutLogMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $openOutLogMenuItem.Text = 'Abrir log out'
  $null = $openOutLogMenuItem.add_Click({
      Open-LogFile -Path $agentOutLogPath
    })

  $openErrLogMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $openErrLogMenuItem.Text = 'Abrir log err'
  $null = $openErrLogMenuItem.add_Click({
      Open-LogFile -Path $agentErrLogPath
    })

  $restartMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $restartMenuItem.Text = 'Reiniciar agente'
  $null = $restartMenuItem.add_Click({
      Restart-AgentTask
      Update-StatusLabel -StatusMenuItem $statusMenuItem -TrayIcon $trayIcon
    })

  $exitMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $exitMenuItem.Text = 'Sair'
  $null = $exitMenuItem.add_Click({
      $script:isShuttingDown = $true
      [System.Windows.Forms.Application]::Exit()
    })

  $null = $contextMenu.Items.Add($statusMenuItem)
  $null = $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
  $null = $contextMenu.Items.Add($showStatusMenuItem)
  $null = $contextMenu.Items.Add($openSupervisorLogMenuItem)
  $null = $contextMenu.Items.Add($openOutLogMenuItem)
  $null = $contextMenu.Items.Add($openErrLogMenuItem)
  $null = $contextMenu.Items.Add($restartMenuItem)
  $null = $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
  $null = $contextMenu.Items.Add($exitMenuItem)

  $trayIcon = New-Object System.Windows.Forms.NotifyIcon

  $iconPath = Join-Path $installRoot 'app\assets\tray.ico'

  if (-not (Test-Path -LiteralPath $iconPath)) {
    throw "Tray icon not found at $iconPath"
  }

  $script:trayIconImage = New-Object System.Drawing.Icon($iconPath)
  $trayIcon.Icon = $script:trayIconImage
  $trayIcon.Visible = $true
  $trayIcon.ContextMenuStrip = $contextMenu
  $null = $trayIcon.add_DoubleClick({
      [System.Windows.Forms.MessageBox]::Show(
        (Get-AgentStatusText),
        'Container Tracker Agent',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null
    })

  Update-StatusLabel -StatusMenuItem $statusMenuItem -TrayIcon $trayIcon
  $trayIcon.ShowBalloonTip(
    2000,
    'Container Tracker Agent',
    'Tray ativo. Use o menu para status e logs.',
    [System.Windows.Forms.ToolTipIcon]::Info
  )

  $monitorTimer = New-Object System.Windows.Forms.Timer
  $monitorTimer.Interval = 5000
  $null = $monitorTimer.add_Tick({
      Ensure-AgentRunning
      Update-StatusLabel -StatusMenuItem $statusMenuItem -TrayIcon $trayIcon
    })
  $monitorTimer.Start()

  [System.Windows.Forms.Application]::Run()
}
finally {
  $script:isShuttingDown = $true

  if ($null -ne $monitorTimer) {
    $monitorTimer.Stop()
    $monitorTimer.Dispose()
  }

  if ($null -ne $trayIcon) {
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
  }

  if ($null -ne $script:trayIconImage) {
    $script:trayIconImage.Dispose()
  }

  if ($null -ne $contextMenu) {
    $contextMenu.Dispose()
  }

  $trayMutex.ReleaseMutex()
  $trayMutex.Dispose()
}
