Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serviceName = 'ContainerTrackerAgent'

Push-Location $repoRoot
try {
  Write-Host '[agent:rebuild-restart] building release bundle...'
  & pnpm run agent:bundle
  if ($LASTEXITCODE -ne 0) {
    throw 'pnpm run agent:bundle failed'
  }

  Write-Host '[agent:rebuild-restart] compiling installer...'
  & pnpm run agent:setup
  if ($LASTEXITCODE -ne 0) {
    throw 'pnpm run agent:setup failed'
  }

  $installerCandidates = @(
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
    $discovered = Get-ChildItem -Path (Join-Path $repoRoot 'tools\agent\installer') `
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
    throw 'installer executable not found after agent:setup'
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
    Restart-Service -Name $serviceName -Force
  } else {
    Write-Host "[agent:rebuild-restart] starting service $serviceName..."
    Start-Service -Name $serviceName
  }

  $finalService = Get-Service -Name $serviceName
  Write-Host "[agent:rebuild-restart] service status: $($finalService.Status)"
  Write-Host '[agent:rebuild-restart] done.'
} finally {
  Pop-Location
}
