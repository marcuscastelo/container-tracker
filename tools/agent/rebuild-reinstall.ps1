Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$agentTaskName = 'ContainerTrackerAgent'
$updaterTaskName = 'ContainerTrackerAgentUpdater'
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$dataLogDir = Join-Path $dataRoot 'logs'
$projectDotEnvPath = Join-Path $repoRoot '.env'
$bootstrapPath = Join-Path $dataRoot 'bootstrap.env'
$configPath = Join-Path $dataRoot 'config.env'
$shortRoot = 'C:\a'
$shortReleaseDir = Join-Path $shortRoot 'release'
$shortInstallerDir = Join-Path $shortRoot 'tools\agent\installer'

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

    $value = Normalize-EnvValue ($entry.Substring($separatorIndex + 1))
    if ($null -ne $value) {
      $result[$key] = $value
    }
  }

  return $result
}

function Get-FirstValue {
  param(
    [hashtable]$Primary,
    [hashtable]$Secondary,
    [hashtable]$Tertiary,
    [string[]]$Keys,
    [AllowNull()]
    [string]$Fallback = $null
  )

  foreach ($key in $Keys) {
    if ($Primary.ContainsKey($key)) {
      $value = Normalize-EnvValue $Primary[$key]
      if ($value) {
        return $value
      }
    }

    $processValue = Normalize-EnvValue ([System.Environment]::GetEnvironmentVariable($key))
    if ($processValue) {
      return $processValue
    }

    if ($Secondary.ContainsKey($key)) {
      $value = Normalize-EnvValue $Secondary[$key]
      if ($value) {
        return $value
      }
    }

    if ($Tertiary.ContainsKey($key)) {
      $value = Normalize-EnvValue $Tertiary[$key]
      if ($value) {
        return $value
      }
    }
  }

  return $Fallback
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

  $content = (($Lines | Where-Object { $_ -and $_.Length -gt 0 }) -join "`r`n") + "`r`n"
  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $content, $encoding)
}

function Sync-AgentEnvFromProjectDotEnv {
  param(
    [string]$ProjectEnvPath,
    [string]$BootstrapEnvPath,
    [string]$ConfigEnvPath
  )

  if (-not (Test-Path $ProjectEnvPath)) {
    throw "project .env not found at $ProjectEnvPath"
  }

  $projectEnv = Read-EnvFileMap -Path $ProjectEnvPath
  $existingBootstrap = Read-EnvFileMap -Path $BootstrapEnvPath
  $existingConfig = Read-EnvFileMap -Path $ConfigEnvPath

  $backendUrl = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('BACKEND_URL', 'AGENT_BACKEND_URL')

  $installerToken = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('INSTALLER_TOKEN', 'AGENT_INSTALLER_TOKEN')

  if (-not $backendUrl -or -not $installerToken) {
    throw 'missing BACKEND_URL and/or INSTALLER_TOKEN in .env or current runtime files'
  }

  $agentIdFallback = Normalize-EnvValue $env:COMPUTERNAME
  if (-not $agentIdFallback) {
    $agentIdFallback = 'container-tracker-agent'
  }

  $agentId = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('AGENT_ID') `
    -Fallback $agentIdFallback

  $intervalSec = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('INTERVAL_SEC', 'AGENT_ENROLL_DEFAULT_INTERVAL_SEC') `
    -Fallback '60'

  $limit = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('LIMIT', 'AGENT_ENROLL_DEFAULT_LIMIT') `
    -Fallback '10'

  $maerskEnabled = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('MAERSK_ENABLED', 'AGENT_ENROLL_DEFAULT_MAERSK_ENABLED') `
    -Fallback '1'

  $maerskHeadless = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('MAERSK_HEADLESS', 'AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS') `
    -Fallback '1'

  $maerskTimeoutMs = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('MAERSK_TIMEOUT_MS', 'AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS') `
    -Fallback '120000'

  $maerskUserDataDir = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('MAERSK_USER_DATA_DIR', 'AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR')

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

  Write-EnvFile -Path $BootstrapEnvPath -Lines $bootstrapLines
  Write-Host "[agent:rebuild-restart] wrote bootstrap.env -> $BootstrapEnvPath"

  $tenantId = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('TENANT_ID', 'SYNC_DEFAULT_TENANT_ID')

  $agentToken = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary @{} `
    -Tertiary @{} `
    -Keys @('AGENT_TOKEN')

  if (-not $tenantId -or -not $agentToken) {
    if (Test-Path $ConfigEnvPath) {
      Remove-Item $ConfigEnvPath -Force
    }

    Write-Warning '[agent:rebuild-restart] config.env not generated (TENANT_ID and AGENT_TOKEN are required). Runtime will use bootstrap enrollment.'
    return
  }

  $supabaseUrl = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('SUPABASE_URL', 'AGENT_ENROLL_SUPABASE_URL')

  $supabaseAnonKey = Get-FirstValue `
    -Primary $projectEnv `
    -Secondary $existingBootstrap `
    -Tertiary $existingConfig `
    -Keys @('SUPABASE_ANON_KEY', 'AGENT_ENROLL_SUPABASE_ANON_KEY')

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

  Write-EnvFile -Path $ConfigEnvPath -Lines $configLines
  Write-Host "[agent:rebuild-restart] wrote config.env -> $ConfigEnvPath"
}

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

  Sync-AgentEnvFromProjectDotEnv `
    -ProjectEnvPath $projectDotEnvPath `
    -BootstrapEnvPath $bootstrapPath `
    -ConfigEnvPath $configPath

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
