Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$shortRoot = 'C:\a'
$shortReleaseDir = Join-Path $shortRoot 'apps\release'
$shortInstallerParent = Join-Path $shortRoot 'apps\agent\src'
$shortInstallerDir = Join-Path $shortInstallerParent 'installer'

function Stop-AgentInstallProcesses {
  param(
    [string]$InstallRootPath
  )

  $deadline = (Get-Date).AddSeconds(20)
  do {
    $running = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
          if ($_.ExecutablePath -and $_.ExecutablePath -like "$InstallRootPath*") {
            return $true
          }
          return $false
        })

    foreach ($process in $running) {
      Write-Warning "[agent:rebuild-restart] stopping process $($process.Name) (PID=$($process.ProcessId))"
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    if ($running.Count -eq 0) {
      return
    }

    Start-Sleep -Milliseconds 400
  } while ((Get-Date) -lt $deadline)

  throw 'failed to stop install-root processes before setup'
}

function Start-AgentStartupLauncher {
  $startupLauncherPath = Join-Path $installRoot 'ct-agent-startup.exe'
  if (-not (Test-Path -LiteralPath $startupLauncherPath)) {
    Write-Warning "[agent:rebuild-restart] startup launcher not found: $startupLauncherPath"
    return
  }

  Write-Host "[agent:rebuild-restart] starting startup launcher: $startupLauncherPath"
  Start-Process `
    -FilePath $startupLauncherPath `
    -WorkingDirectory $installRoot `
    -WindowStyle Hidden | Out-Null
}

function Show-StartupDiagnostics {
  $startupLogPath = Join-Path $dataRoot 'logs\startup.log'
  $supervisorLogPath = Join-Path $dataRoot 'logs\supervisor.log'
  foreach ($logPath in @($startupLogPath, $supervisorLogPath)) {
    if (Test-Path -LiteralPath $logPath) {
      Write-Host "[agent:rebuild-restart] log tail: $logPath"
      Get-Content -LiteralPath $logPath -Tail 40
    }
  }
}

Push-Location $repoRoot
try {
  Write-Host '[agent:rebuild-restart] building release bundle...'
  & pnpm run agent:bundle
  if ($LASTEXITCODE -ne 0) {
    throw 'pnpm run agent:bundle failed'
  }

  Write-Host "[agent:rebuild-restart] preparing short path workspace at $shortRoot..."
  New-Item -ItemType Directory -Path $shortRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $shortInstallerParent -Force | Out-Null

  if (Test-Path $shortReleaseDir) {
    Remove-Item $shortReleaseDir -Recurse -Force
  }
  if (Test-Path $shortInstallerDir) {
    Remove-Item $shortInstallerDir -Recurse -Force
  }

  Copy-Item (Join-Path $repoRoot 'release') $shortReleaseDir -Recurse -Force
  Copy-Item (Join-Path $repoRoot 'apps\agent\src\installer') $shortInstallerDir -Recurse -Force

  Write-Host '[agent:rebuild-restart] compiling installer from short path...'
  & iscc (Join-Path $shortInstallerDir 'installer.iss')
  if ($LASTEXITCODE -ne 0) {
    throw 'iscc failed while compiling installer from short path workspace'
  }

  $installerCandidates = @(
    (Join-Path $shortInstallerDir 'Output\ContainerTrackerAgent-Setup.exe'),
    (Join-Path $shortInstallerDir 'ContainerTrackerAgent-Setup.exe'),
    (Join-Path $repoRoot 'apps\agent\src\installer\Output\ContainerTrackerAgent-Setup.exe'),
    (Join-Path $repoRoot 'apps\agent\src\installer\ContainerTrackerAgent-Setup.exe')
  )

  $installerPath = $null
  foreach ($candidate in $installerCandidates) {
    if (Test-Path $candidate) {
      $installerPath = $candidate
      break
    }
  }

  if (-not $installerPath) {
    throw 'installer executable not found after iscc compilation'
  }

  Stop-AgentInstallProcesses -InstallRootPath $installRoot

  $installerLogPath = Join-Path $shortRoot 'installer-run.log'
  if (Test-Path $installerLogPath) {
    Remove-Item $installerLogPath -Force
  }

  Write-Host "[agent:rebuild-restart] running installer: $installerPath"
  & $installerPath '/VERYSILENT' '/SUPPRESSMSGBOXES' '/NORESTART' "/LOG=$installerLogPath"
  $installerExitCode = $LASTEXITCODE

  if ($installerExitCode -ne 0) {
    if (Test-Path $installerLogPath) {
      Write-Warning "[agent:rebuild-restart] installer log tail: $installerLogPath"
      Get-Content $installerLogPath -Tail 120
    }

    throw "installer failed with exit code $installerExitCode"
  }

  Write-Host '[agent:rebuild-restart] bootstrap.env is provided by installer payload.'
  Write-Host '[agent:rebuild-restart] config.env generation by this script is disabled; runtime enrollment is responsible for creating it.'

  Write-Host "[agent:rebuild-restart] starting agent startup launcher..."
  Start-AgentStartupLauncher

  Start-Sleep -Seconds 2
  Show-StartupDiagnostics

  Write-Host '[agent:rebuild-restart] done.'
} finally {
  Pop-Location
}
