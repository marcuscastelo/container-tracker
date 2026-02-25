Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serviceName = 'ContainerTrackerAgent'
$shortRoot = 'C:\a'
$shortReleaseDir = Join-Path $shortRoot 'release'
$shortInstallerDir = Join-Path $shortRoot 'tools\agent\installer'
$winswExe = 'C:\Program Files\ContainerTrackerAgent\winsw\ContainerTrackerAgent.exe'
$serviceLogDir = 'C:\ProgramData\ContainerTrackerAgent\logs'

function Write-ServiceDiagnostics {
  param(
    [string]$Name
  )

  Write-Host "[agent:rebuild-restart] diagnostics for service $Name"

  try {
    & sc.exe query $Name
  } catch {
    Write-Warning "[agent:rebuild-restart] failed to query service via sc.exe: $($_.Exception.Message)"
  }

  $errLogPath = Join-Path $serviceLogDir 'ContainerTrackerAgent.err.log'
  $outLogPath = Join-Path $serviceLogDir 'ContainerTrackerAgent.out.log'

  if (Test-Path $errLogPath) {
    Write-Host "[agent:rebuild-restart] tail $errLogPath"
    Get-Content $errLogPath -Tail 80
  } else {
    Write-Host "[agent:rebuild-restart] err log not found: $errLogPath"
  }

  if (Test-Path $outLogPath) {
    Write-Host "[agent:rebuild-restart] tail $outLogPath"
    Get-Content $outLogPath -Tail 80
  } else {
    Write-Host "[agent:rebuild-restart] out log not found: $outLogPath"
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
    $searchRoots = @(
      $shortInstallerDir,
      (Join-Path $repoRoot 'tools\agent\installer')
    )

    $discovered = Get-ChildItem -Path $searchRoots `
      -Recurse `
      -File `
      -Filter 'ContainerTrackerAgent-Setup*.exe' `
      -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if ($discovered) {
      $installerPath = $discovered.FullName
    }
  }

  if (-not $installerPath) {
    throw 'installer executable not found after iscc compilation'
  }

  Write-Host "[agent:rebuild-restart] running installer: $installerPath"
  $installProcess = Start-Process -FilePath $installerPath `
    -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') `
    -Wait `
    -PassThru

  if ($installProcess.ExitCode -ne 0) {
    throw "installer failed with exit code $($installProcess.ExitCode)"
  }

  Start-Sleep -Seconds 1

  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if (-not $service) {
    throw "service $serviceName was not found after installer execution"
  }

  if ($service.Status -eq 'Running') {
    Write-Host "[agent:rebuild-restart] restarting service $serviceName..."
    try {
      Restart-Service -Name $serviceName -Force
    } catch {
      Write-Warning "[agent:rebuild-restart] Restart-Service failed: $($_.Exception.Message)"
      if (Test-Path $winswExe) {
        Write-Host "[agent:rebuild-restart] attempting WinSW restart fallback..."
        & $winswExe restart
      } else {
        throw
      }
    }
  } else {
    Write-Host "[agent:rebuild-restart] starting service $serviceName..."
    try {
      Start-Service -Name $serviceName
    } catch {
      Write-Warning "[agent:rebuild-restart] Start-Service failed: $($_.Exception.Message)"
      if (Test-Path $winswExe) {
        Write-Host "[agent:rebuild-restart] attempting WinSW start fallback..."
        & $winswExe start
      } else {
        throw
      }
    }
  }

  Start-Sleep -Seconds 2
  $finalService = Get-Service -Name $serviceName
  if ($finalService.Status -ne 'Running') {
    Write-ServiceDiagnostics -Name $serviceName
    throw "service $serviceName did not reach Running state (current: $($finalService.Status))"
  }

  Write-Host "[agent:rebuild-restart] service status: $($finalService.Status)"
  Write-Host '[agent:rebuild-restart] done.'
} finally {
  Pop-Location
}
