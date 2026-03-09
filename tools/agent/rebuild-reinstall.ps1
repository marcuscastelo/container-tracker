Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$agentTaskName = 'ContainerTrackerAgent'
$updaterTaskName = 'ContainerTrackerAgentUpdater'
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$dataLogDir = Join-Path $dataRoot 'logs'
$shortRoot = 'C:\a'
$shortReleaseDir = Join-Path $shortRoot 'release'
$shortInstallerDir = Join-Path $shortRoot 'tools\agent\installer'

function Stop-AgentInstallProcesses {
  param(
    [string]$InstallRootPath
  )

  $deadline = (Get-Date).AddSeconds(20)
  do {
    $running = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like "$InstallRootPath*" })

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

function Invoke-SafeTaskDelete {
  param(
    [string]$TaskName
  )

  & cmd.exe /d /s /c "schtasks /Delete /TN ""$TaskName"" /F >NUL 2>&1 || exit /B 0"
  if ($LASTEXITCODE -ne 0) {
    throw "failed to delete scheduled task $TaskName (exit code $LASTEXITCODE)"
  }
}

function Show-TaskDiagnostics {
  function Show-OptionalTaskQuery {
    param(
      [string]$TaskName
    )

    & cmd.exe /d /s /c "schtasks /Query /TN ""$TaskName"" /V /FO LIST 2>NUL || (echo [agent:rebuild-restart] task not found: $TaskName & exit /B 0)"
    if ($LASTEXITCODE -ne 0) {
      throw "failed to query scheduled task $TaskName (exit code $LASTEXITCODE)"
    }
  }

  Show-OptionalTaskQuery -TaskName $agentTaskName
  Show-OptionalTaskQuery -TaskName $updaterTaskName

  $updaterLog = Join-Path $dataLogDir 'updater.log'
  if (Test-Path $updaterLog) {
    Write-Host "[agent:rebuild-restart] tail $updaterLog"
    Get-Content $updaterLog -Tail 80
  } else {
    Write-Host "[agent:rebuild-restart] updater log not found: $updaterLog"
  }
}

function Invoke-SafeTaskRun {
  param(
    [string]$TaskName
  )

  $maxAttempts = 30
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    & cmd.exe /d /s /c "schtasks /Run /TN ""$TaskName"" >NUL 2>&1"
    if ($LASTEXITCODE -eq 0) {
      return
    }

    Start-Sleep -Milliseconds 400
  }

  Write-Warning "[agent:rebuild-restart] failed to run task $TaskName after $maxAttempts attempts; dumping task query for diagnostics"
  throw "failed to run scheduled task $TaskName after $maxAttempts attempts"
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

  if (Test-Path $shortReleaseDir) {
    Remove-Item $shortReleaseDir -Recurse -Force
  }
  if (Test-Path $shortInstallerDir) {
    Remove-Item $shortInstallerDir -Recurse -Force
  }

  Copy-Item (Join-Path $repoRoot 'release') $shortReleaseDir -Recurse -Force
  Copy-Item (Join-Path $repoRoot 'tools\agent\installer') $shortInstallerDir -Recurse -Force

  Write-Host '[agent:rebuild-restart] compiling installer from short path...'
  & iscc (Join-Path $shortInstallerDir 'installer.iss')
  if ($LASTEXITCODE -ne 0) {
    throw 'iscc failed while compiling installer from short path workspace'
  }

  $installerCandidates = @(
    (Join-Path $shortInstallerDir 'Output\ContainerTrackerAgent-Setup.exe'),
    (Join-Path $shortInstallerDir 'ContainerTrackerAgent-Setup.exe'),
    (Join-Path $repoRoot 'tools\agent\installer\Output\ContainerTrackerAgent-Setup.exe'),
    (Join-Path $repoRoot 'tools\agent\installer\ContainerTrackerAgent-Setup.exe')
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
  Invoke-SafeTaskDelete -TaskName $agentTaskName
  Invoke-SafeTaskDelete -TaskName $updaterTaskName

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

  Write-Host "[agent:rebuild-restart] starting scheduled tasks..."
  try {
    Invoke-SafeTaskRun -TaskName $agentTaskName
  } catch {
    Write-Warning "[agent:rebuild-restart] could not run task $agentTaskName immediately: $($_.Exception.Message)"
  }
  try {
    Invoke-SafeTaskRun -TaskName $updaterTaskName
  } catch {
    Write-Warning "[agent:rebuild-restart] could not run task $updaterTaskName immediately: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds 2
  Show-TaskDiagnostics

  Write-Host '[agent:rebuild-restart] done.'
} finally {
  Pop-Location
}
