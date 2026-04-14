Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$logsDir = Join-Path $dataRoot 'logs'
$nodeExePath = Join-Path $installRoot 'node\node.exe'
$registerAliasLoaderPath = Join-Path $installRoot 'app\dist\apps\agent\src\runtime\register-alias-loader.js'
$agentScriptPath = Join-Path $installRoot 'app\dist\apps\agent\src\agent.js'
$agentOutLogPath = Join-Path $logsDir 'agent.out.log'
$agentErrLogPath = Join-Path $logsDir 'agent.err.log'
$registerAliasLoaderUrl = $null

$script:agentProcess = $null
$script:lastAgentStartUtc = $null
$script:lastAgentExitCode = $null
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

function Convert-ToCmdQuoted {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  return '"' + $Value.Replace('"', '""') + '"'
}

function Stop-AgentNodeProcesses {
  $normalizedInstallRoot = $installRoot.ToLowerInvariant()
  $agentCommandFragments = @(
    '\app\dist\apps\agent\src\supervisor.js',
    '\app\dist\apps\agent\src\agent.js',
    '\app\dist\agent.js'
  )

  $candidateProcesses = @(
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      if (-not $_.CommandLine) {
        return $false
      }

      $normalizedCommandLine = $_.CommandLine.ToLowerInvariant()
      return (
        $normalizedCommandLine.Contains($normalizedInstallRoot) -and
        ($agentCommandFragments | Where-Object { $normalizedCommandLine.Contains($_) }).Count -gt 0
      )
    }
  )

  foreach ($candidateProcess in $candidateProcesses) {
    Stop-Process -Id $candidateProcess.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Start-AgentProcess {
  if (-not (Test-Path -LiteralPath $nodeExePath)) {
    throw "node.exe not found at $nodeExePath"
  }

  if (-not (Test-Path -LiteralPath $registerAliasLoaderPath)) {
    throw "register-alias-loader.js not found at $registerAliasLoaderPath"
  }

  $registerAliasLoaderUrl = [System.Uri]::new($registerAliasLoaderPath).AbsoluteUri

  if (-not (Test-Path -LiteralPath $agentScriptPath)) {
    throw "agent.js not found at $agentScriptPath"
  }

  Ensure-FileExists -Path $agentOutLogPath
  Ensure-FileExists -Path $agentErrLogPath

  $nodeExeQuoted = Convert-ToCmdQuoted -Value $nodeExePath
  $registerAliasLoaderQuoted = Convert-ToCmdQuoted -Value $registerAliasLoaderUrl
  $agentScriptQuoted = Convert-ToCmdQuoted -Value $agentScriptPath
  $outLogQuoted = Convert-ToCmdQuoted -Value $agentOutLogPath
  $errLogQuoted = Convert-ToCmdQuoted -Value $agentErrLogPath

  $agentCommand =
    "$nodeExeQuoted --import $registerAliasLoaderQuoted $agentScriptQuoted 1>>$outLogQuoted 2>>$errLogQuoted"
  $cmdArguments = @(
    '/d',
    '/s',
    '/c',
    "`"$agentCommand`""
  )

  $script:agentProcess = Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList $cmdArguments `
    -WindowStyle Hidden `
    -PassThru

  $script:lastAgentStartUtc = [DateTime]::UtcNow
  $script:lastAgentExitCode = $null
  $script:lastAgentError = $null
}

function Is-AgentRunning {
  if ($null -eq $script:agentProcess) {
    return $false
  }

  try {
    $script:agentProcess.Refresh()
  }
  catch {
    return $false
  }

  return -not $script:agentProcess.HasExited
}

function Ensure-AgentRunning {
  if ($script:isShuttingDown) {
    return
  }

  if (Is-AgentRunning) {
    return
  }

  if ($null -ne $script:agentProcess -and $script:agentProcess.HasExited) {
    $script:lastAgentExitCode = $script:agentProcess.ExitCode
  }

  try {
    Start-AgentProcess
  }
  catch {
    $script:lastAgentError = $_.Exception.Message
  }
}

function Stop-AgentProcess {
  if ($null -ne $script:agentProcess -and -not $script:agentProcess.HasExited) {
    Stop-Process -Id $script:agentProcess.Id -Force -ErrorAction SilentlyContinue
  }

  Stop-AgentNodeProcesses
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
  $statusLabel = if (Is-AgentRunning) {
    "Ativo (PID $($script:agentProcess.Id))"
  }
  else {
    'Parado'
  }

  $lines = @(
    "Status: $statusLabel",
    "Log out: $agentOutLogPath",
    "Log err: $agentErrLogPath"
  )

  if ($null -ne $script:lastAgentStartUtc) {
    $lines += "Ultimo start UTC: $($script:lastAgentStartUtc.ToString('yyyy-MM-dd HH:mm:ss'))"
  }

  if ($null -ne $script:lastAgentExitCode) {
    $lines += "Ultimo exit code: $($script:lastAgentExitCode)"
  }

  if ($script:lastAgentError) {
    $lines += "Ultimo erro: $($script:lastAgentError)"
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

  if (Is-AgentRunning) {
    $StatusMenuItem.Text = "Status: ativo (PID $($script:agentProcess.Id))"
    Set-NotifyText -TrayIcon $TrayIcon -Text 'Container Tracker Agent - Ativo'
    return
  }

  if ($script:lastAgentError) {
    $StatusMenuItem.Text = 'Status: erro ao iniciar (veja log err)'
    Set-NotifyText -TrayIcon $TrayIcon -Text 'Container Tracker Agent - Erro'
    return
  }

  $StatusMenuItem.Text = 'Status: parado'
  Set-NotifyText -TrayIcon $TrayIcon -Text 'Container Tracker Agent - Parado'
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
  Ensure-FileExists -Path $agentOutLogPath
  Ensure-FileExists -Path $agentErrLogPath

  Stop-AgentNodeProcesses
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
      Stop-AgentProcess
      Start-Sleep -Milliseconds 250
      Ensure-AgentRunning
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

  Stop-AgentProcess

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
