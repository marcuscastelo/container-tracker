Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serviceName = 'ContainerTrackerAgent'
$installRoot = 'C:\Program Files\ContainerTrackerAgent'
$programDataDir = 'C:\ProgramData\ContainerTrackerAgent'
$shortRoot = 'C:\a'
$shortReleaseDir = Join-Path $shortRoot 'release'
$shortInstallerDir = Join-Path $shortRoot 'tools\agent\installer'
$winswExe = Join-Path $installRoot 'winsw\ContainerTrackerAgent.exe'
$serviceLogDir = Join-Path $programDataDir 'logs'
$projectDotEnvPath = Join-Path $repoRoot '.env'
$programDataBootstrapPath = Join-Path $programDataDir 'bootstrap.env'
$programDataConfigPath = Join-Path $programDataDir 'config.env'

$placeholderBackendHost = 'your-backend.example.com'
$placeholderSupabaseHost = 'your-project.supabase.co'
$placeholderTokenFragment = 'replace-with-'
$placeholderTenantId = '00000000-0000-4000-8000-000000000000'

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

function Normalize-EnvValue {
  param(
    [AllowNull()]
    [string]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  $normalized = $Value.Trim()
  if ($normalized.Length -eq 0) {
    return $null
  }

  if ($normalized.Length -ge 2) {
    if ($normalized.StartsWith('"') -and $normalized.EndsWith('"')) {
      return $normalized.Substring(1, $normalized.Length - 2)
    }
    if ($normalized.StartsWith("'") -and $normalized.EndsWith("'")) {
      return $normalized.Substring(1, $normalized.Length - 2)
    }
  }

  return $normalized
}

function Read-EnvFileMap {
  param(
    [string]$Path
  )

  $result = @{}
  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($line in Get-Content -Path $Path) {
    $entry = $line.Trim()
    if ($entry.Length -eq 0 -or $entry.StartsWith('#')) {
      continue
    }

    if ($entry.StartsWith('export ')) {
      $entry = $entry.Substring(7).TrimStart()
    }

    $separatorIndex = $entry.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $entry.Substring(0, $separatorIndex).Trim()
    if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
      continue
    }

    $rawValue = $entry.Substring($separatorIndex + 1)
    $value = Normalize-EnvValue $rawValue
    if ($null -ne $value) {
      $result[$key] = $value
    }
  }

  return $result
}

function Get-UrlHost {
  param(
    [string]$Value
  )

  try {
    $uri = [System.Uri]::new($Value)
    return $uri.Host.ToLowerInvariant()
  } catch {
    return $null
  }
}

function Is-PlaceholderValue {
  param(
    [string]$CanonicalKey,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  switch ($CanonicalKey) {
    'BACKEND_URL' {
      return (Get-UrlHost $Value) -eq $placeholderBackendHost
    }
    'SUPABASE_URL' {
      return (Get-UrlHost $Value) -eq $placeholderSupabaseHost
    }
    'TENANT_ID' {
      return $Value -eq $placeholderTenantId
    }
    'INSTALLER_TOKEN' {
      $normalized = $Value.ToLowerInvariant()
      return $normalized.Contains($placeholderTokenFragment) -or
        $normalized.StartsWith('seu_') -or
        $normalized.StartsWith('your_')
    }
    'AGENT_TOKEN' {
      $normalized = $Value.ToLowerInvariant()
      return $normalized.Contains($placeholderTokenFragment) -or
        $normalized.StartsWith('seu_') -or
        $normalized.StartsWith('your_')
    }
    'SUPABASE_ANON_KEY' {
      $normalized = $Value.ToLowerInvariant()
      return $normalized.Contains($placeholderTokenFragment) -or
        $normalized.StartsWith('seu_') -or
        $normalized.StartsWith('your_')
    }
  }

  return $false
}

function Get-ResolvedEnvValue {
  param(
    [hashtable]$ProjectEnv,
    [hashtable]$ExistingBootstrap,
    [hashtable]$ExistingConfig,
    [string]$CanonicalKey,
    [string[]]$CandidateKeys
  )

  foreach ($key in $CandidateKeys) {
    if ($ProjectEnv.ContainsKey($key)) {
      $value = Normalize-EnvValue $ProjectEnv[$key]
      if ($value -and -not (Is-PlaceholderValue -CanonicalKey $CanonicalKey -Value $value)) {
        return $value
      }
    }

    $processValue = Normalize-EnvValue ([System.Environment]::GetEnvironmentVariable($key))
    if ($processValue -and -not (Is-PlaceholderValue -CanonicalKey $CanonicalKey -Value $processValue)) {
      return $processValue
    }
  }

  if ($ExistingBootstrap.ContainsKey($CanonicalKey)) {
    $bootstrapValue = Normalize-EnvValue $ExistingBootstrap[$CanonicalKey]
    if ($bootstrapValue -and -not (Is-PlaceholderValue -CanonicalKey $CanonicalKey -Value $bootstrapValue)) {
      return $bootstrapValue
    }
  }

  if ($ExistingConfig.ContainsKey($CanonicalKey)) {
    $configValue = Normalize-EnvValue $ExistingConfig[$CanonicalKey]
    if ($configValue -and -not (Is-PlaceholderValue -CanonicalKey $CanonicalKey -Value $configValue)) {
      return $configValue
    }
  }

  return $null
}

function Get-OptionalResolvedEnvValue {
  param(
    [hashtable]$ProjectEnv,
    [hashtable]$ExistingBootstrap,
    [hashtable]$ExistingConfig,
    [string]$CanonicalKey,
    [string[]]$CandidateKeys,
    [AllowNull()]
    [string]$Fallback = $null
  )

  $resolved = Get-ResolvedEnvValue `
    -ProjectEnv $ProjectEnv `
    -ExistingBootstrap $ExistingBootstrap `
    -ExistingConfig $ExistingConfig `
    -CanonicalKey $CanonicalKey `
    -CandidateKeys $CandidateKeys

  if ($resolved) {
    return $resolved
  }

  return $Fallback
}

function Get-ProjectOrProcessValue {
  param(
    [hashtable]$ProjectEnv,
    [string]$CanonicalKey,
    [string[]]$CandidateKeys
  )

  foreach ($key in $CandidateKeys) {
    if ($ProjectEnv.ContainsKey($key)) {
      $value = Normalize-EnvValue $ProjectEnv[$key]
      if ($value -and -not (Is-PlaceholderValue -CanonicalKey $CanonicalKey -Value $value)) {
        return $value
      }
    }

    $processValue = Normalize-EnvValue ([System.Environment]::GetEnvironmentVariable($key))
    if ($processValue -and -not (Is-PlaceholderValue -CanonicalKey $CanonicalKey -Value $processValue)) {
      return $processValue
    }
  }

  return $null
}

function Get-RequiredResolvedEnvValue {
  param(
    [hashtable]$ProjectEnv,
    [hashtable]$ExistingBootstrap,
    [hashtable]$ExistingConfig,
    [string]$CanonicalKey,
    [string[]]$CandidateKeys
  )

  $resolved = Get-ResolvedEnvValue `
    -ProjectEnv $ProjectEnv `
    -ExistingBootstrap $ExistingBootstrap `
    -ExistingConfig $ExistingConfig `
    -CanonicalKey $CanonicalKey `
    -CandidateKeys $CandidateKeys

  if ($resolved) {
    return $resolved
  }

  $aliases = ($CandidateKeys -join ', ')
  throw "missing required key for $CanonicalKey (checked: $aliases). Populate project .env or process environment."
}

function Write-EnvFile {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  $parent = Split-Path -Path $Path -Parent
  if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  $content = (($Lines | Where-Object { $_ -ne $null -and $_.Length -gt 0 }) -join "`r`n") + "`r`n"
  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $content, $encoding)
}

function Sync-AgentEnvFromProjectDotEnv {
  param(
    [string]$ProjectEnvPath,
    [string]$BootstrapPath,
    [string]$ConfigPath
  )

  if (-not (Test-Path $ProjectEnvPath)) {
    throw "project .env not found at $ProjectEnvPath"
  }

  $projectEnv = Read-EnvFileMap -Path $ProjectEnvPath
  $existingBootstrap = Read-EnvFileMap -Path $BootstrapPath
  $existingConfig = Read-EnvFileMap -Path $ConfigPath

  $backendUrl = Get-RequiredResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'BACKEND_URL' `
    -CandidateKeys @('BACKEND_URL', 'AGENT_BACKEND_URL')

  $installerToken = Get-RequiredResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'INSTALLER_TOKEN' `
    -CandidateKeys @('INSTALLER_TOKEN', 'AGENT_INSTALLER_TOKEN')

  $agentIdFallback = Normalize-EnvValue $env:COMPUTERNAME
  if (-not $agentIdFallback) {
    $agentIdFallback = 'container-tracker-agent'
  }

  $agentId = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'AGENT_ID' `
    -CandidateKeys @('AGENT_ID') `
    -Fallback $agentIdFallback

  $intervalSec = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'INTERVAL_SEC' `
    -CandidateKeys @('INTERVAL_SEC', 'AGENT_ENROLL_DEFAULT_INTERVAL_SEC') `
    -Fallback '60'

  $limit = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'LIMIT' `
    -CandidateKeys @('LIMIT', 'AGENT_ENROLL_DEFAULT_LIMIT') `
    -Fallback '10'

  $maerskEnabled = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'MAERSK_ENABLED' `
    -CandidateKeys @('MAERSK_ENABLED', 'AGENT_ENROLL_DEFAULT_MAERSK_ENABLED') `
    -Fallback '1'

  $maerskHeadless = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'MAERSK_HEADLESS' `
    -CandidateKeys @('MAERSK_HEADLESS', 'AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS') `
    -Fallback '1'

  $maerskTimeoutMs = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'MAERSK_TIMEOUT_MS' `
    -CandidateKeys @('MAERSK_TIMEOUT_MS', 'AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS') `
    -Fallback '120000'

  $maerskUserDataDir = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'MAERSK_USER_DATA_DIR' `
    -CandidateKeys @('MAERSK_USER_DATA_DIR', 'AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR')

  $bootstrapLines = @(
    "BACKEND_URL=$backendUrl",
    "INSTALLER_TOKEN=$installerToken",
    "AGENT_ID=$agentId",
    "INTERVAL_SEC=$intervalSec",
    "LIMIT=$limit",
    "MAERSK_ENABLED=$maerskEnabled",
    "MAERSK_HEADLESS=$maerskHeadless",
    "MAERSK_TIMEOUT_MS=$maerskTimeoutMs"
  )
  if ($maerskUserDataDir) {
    $bootstrapLines += "MAERSK_USER_DATA_DIR=$maerskUserDataDir"
  }

  Write-EnvFile -Path $BootstrapPath -Lines $bootstrapLines
  Write-Host "[agent:rebuild-restart] wrote bootstrap.env from project .env values"

  $tenantId = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'TENANT_ID' `
    -CandidateKeys @('TENANT_ID', 'SYNC_DEFAULT_TENANT_ID')

  $agentToken = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap @{} `
    -ExistingConfig @{} `
    -CanonicalKey 'AGENT_TOKEN' `
    -CandidateKeys @('AGENT_TOKEN')

  $supabaseUrl = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'SUPABASE_URL' `
    -CandidateKeys @('SUPABASE_URL', 'AGENT_ENROLL_SUPABASE_URL')

  $supabaseAnonKey = Get-OptionalResolvedEnvValue `
    -ProjectEnv $projectEnv `
    -ExistingBootstrap $existingBootstrap `
    -ExistingConfig $existingConfig `
    -CanonicalKey 'SUPABASE_ANON_KEY' `
    -CandidateKeys @('SUPABASE_ANON_KEY', 'AGENT_ENROLL_SUPABASE_ANON_KEY')

  if ($tenantId -and $agentToken) {
    $configLines = @(
      "BACKEND_URL=$backendUrl",
      "TENANT_ID=$tenantId",
      "AGENT_TOKEN=$agentToken",
      "AGENT_ID=$agentId",
      "INTERVAL_SEC=$intervalSec",
      "LIMIT=$limit",
      "MAERSK_ENABLED=$maerskEnabled",
      "MAERSK_HEADLESS=$maerskHeadless",
      "MAERSK_TIMEOUT_MS=$maerskTimeoutMs"
    )

    if ($supabaseUrl) {
      $configLines += "SUPABASE_URL=$supabaseUrl"
    }
    if ($supabaseAnonKey) {
      $configLines += "SUPABASE_ANON_KEY=$supabaseAnonKey"
    }
    if ($maerskUserDataDir) {
      $configLines += "MAERSK_USER_DATA_DIR=$maerskUserDataDir"
    }

    Write-EnvFile -Path $ConfigPath -Lines $configLines
    Write-Host '[agent:rebuild-restart] wrote config.env from project .env/runtime values'
    return
  }

  if (Test-Path $ConfigPath) {
    Remove-Item $ConfigPath -Force
  }

  $missingConfigKeys = @()
  if (-not $tenantId) {
    $missingConfigKeys += 'TENANT_ID (or SYNC_DEFAULT_TENANT_ID)'
  }
  if (-not $agentToken) {
    $missingConfigKeys += 'AGENT_TOKEN'
  }

  Write-Warning "[agent:rebuild-restart] config.env not generated from .env (missing: $($missingConfigKeys -join ', ')). Startup will use bootstrap enrollment."
}

function Get-AgentInstallProcesses {
  param(
    [string]$InstallRootPath
  )

  return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath -like "$InstallRootPath*"
      })
}

function Stop-AgentForInstall {
  param(
    [string]$Name,
    [string]$InstallRootPath,
    [string]$WinSwPath
  )

  Write-Host "[agent:rebuild-restart] stopping service/processes before installer..."

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($service -and $service.Status -ne 'Stopped') {
    try {
      Stop-Service -Name $Name -Force -ErrorAction Stop
    } catch {
      Write-Warning "[agent:rebuild-restart] Stop-Service failed: $($_.Exception.Message)"
    }
  }

  if (Test-Path $WinSwPath) {
    try {
      & $WinSwPath stop | Out-Null
    } catch {
      Write-Warning "[agent:rebuild-restart] WinSW stop fallback failed: $($_.Exception.Message)"
    }
  }

  $deadline = (Get-Date).AddSeconds(20)
  $running = @(Get-AgentInstallProcesses -InstallRootPath $InstallRootPath)

  while ($running.Count -gt 0 -and (Get-Date) -lt $deadline) {
    foreach ($process in $running) {
      Write-Warning "[agent:rebuild-restart] terminating locked process $($process.Name) (PID=$($process.ProcessId))"
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 500
    $running = @(Get-AgentInstallProcesses -InstallRootPath $InstallRootPath)
  }

  if ($running.Count -gt 0) {
    $details = ($running | ForEach-Object { "$($_.Name)#$($_.ProcessId)" }) -join ', '
    throw "failed to stop install-root processes before setup: $details"
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

  Stop-AgentForInstall -Name $serviceName -InstallRootPath $installRoot -WinSwPath $winswExe

  Write-Host "[agent:rebuild-restart] running installer: $installerPath"
  $installProcess = Start-Process -FilePath $installerPath `
    -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') `
    -Wait `
    -PassThru

  if ($installProcess.ExitCode -ne 0) {
    throw "installer failed with exit code $($installProcess.ExitCode)"
  }

  Sync-AgentEnvFromProjectDotEnv `
    -ProjectEnvPath $projectDotEnvPath `
    -BootstrapPath $programDataBootstrapPath `
    -ConfigPath $programDataConfigPath

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
