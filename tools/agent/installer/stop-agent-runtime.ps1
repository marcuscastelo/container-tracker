param(
  [switch]$CleanupNodeModules
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$normalizedInstallRoot = $installRoot.ToLowerInvariant()
$appRootPath = Join-Path $installRoot 'app'
$nodeModulesPath = Join-Path $installRoot 'app\node_modules'
$pnpmStorePath = Join-Path $nodeModulesPath '.pnpm'
$logsDir = Join-Path (Join-Path $env:LOCALAPPDATA 'ContainerTracker') 'logs'
$cleanupLogPath = Join-Path $logsDir 'uninstall-cleanup.log'
$emitConsoleLog = $true

function Write-CleanupLog {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  try {
    if (-not (Test-Path -LiteralPath $logsDir)) {
      New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    }

    $line = '[{0}] {1}' -f [DateTime]::UtcNow.ToString('o'), $Message
    Add-Content -Path $cleanupLogPath -Value $line
    if ($emitConsoleLog) {
      Write-Output $line
    }
  }
  catch {
    # Best effort logging only.
  }
}

function Test-IsInstallRootProcess {
  param(
    [Parameter(Mandatory = $true)]
    [object]$ProcessRecord
  )

  $commandLine = if ($ProcessRecord.CommandLine) {
    $ProcessRecord.CommandLine.ToLowerInvariant()
  }
  else {
    ''
  }

  $executablePath = if ($ProcessRecord.ExecutablePath) {
    $ProcessRecord.ExecutablePath.ToLowerInvariant()
  }
  else {
    ''
  }

  $processName = if ($ProcessRecord.Name) {
    $ProcessRecord.Name.ToLowerInvariant()
  }
  else {
    ''
  }

  # Never target Inno uninstaller processes. Killing unins000.exe/_unins.tmp aborts uninstall.
  if (
    ($processName -match '^_?unins.*\.(exe|tmp)$') -or
    ($executablePath -match '\\_?unins[^\\]*\.(exe|tmp)$') -or
    ($commandLine -match '\\_?unins[^\\]*\.(exe|tmp)(\"|\s|$)')
  ) {
    return $false
  }

  $commandLineMatch = $commandLine.Length -gt 0 -and $commandLine.Contains($normalizedInstallRoot)
  $executablePathMatch = $executablePath.Length -gt 0 -and $executablePath.StartsWith($normalizedInstallRoot)
  return $commandLineMatch -or $executablePathMatch
}

function Get-ProcessMap {
  $processMap = @{}
  $allProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)

  foreach ($processRecord in $allProcesses) {
    if ($null -eq $processRecord.ProcessId) {
      continue
    }

    $processMap[[int]$processRecord.ProcessId] = $processRecord
  }

  return $processMap
}

function Get-InstallRootRelatedProcessIds {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$ProcessMap
  )

  $relatedProcessIds = New-Object 'System.Collections.Generic.HashSet[int]'
  $queue = New-Object 'System.Collections.Generic.Queue[int]'

  foreach ($processRecord in $ProcessMap.Values) {
    if (-not (Test-IsInstallRootProcess -ProcessRecord $processRecord)) {
      continue
    }

    $processId = [int]$processRecord.ProcessId
    if ($processId -eq $PID) {
      continue
    }

    if ($relatedProcessIds.Add($processId)) {
      $queue.Enqueue($processId)
    }
  }

  while ($queue.Count -gt 0) {
    $parentId = $queue.Dequeue()

    foreach ($candidateChild in $ProcessMap.Values) {
      if ($null -eq $candidateChild.ParentProcessId) {
        continue
      }

      $candidateParentId = [int]$candidateChild.ParentProcessId
      if ($candidateParentId -ne $parentId) {
        continue
      }

      $childId = [int]$candidateChild.ProcessId
      if ($childId -eq $PID) {
        continue
      }

      if ($relatedProcessIds.Add($childId)) {
        $queue.Enqueue($childId)
      }
    }
  }

  return @($relatedProcessIds)
}

function Stop-InstallRootProcesses {
  $maxAttempts = 12
  $delayMilliseconds = 500

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $processMap = Get-ProcessMap
    $relatedProcessIds = @(Get-InstallRootRelatedProcessIds -ProcessMap $processMap)
    if ($relatedProcessIds.Count -eq 0) {
      Write-CleanupLog -Message "stop-process attempt=$attempt no matching processes"
      return $true
    }

    $orderedIds = @($relatedProcessIds) | Sort-Object -Descending
    Write-CleanupLog -Message "stop-process attempt=$attempt found=$($orderedIds.Count) ids=$([string]::Join(',', $orderedIds))"
    foreach ($processId in $orderedIds) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds $delayMilliseconds
  }

  $remainingProcessMap = Get-ProcessMap
  $remainingIds = @(Get-InstallRootRelatedProcessIds -ProcessMap $remainingProcessMap)

  if ($remainingIds.Count -eq 0) {
    Write-CleanupLog -Message "stop-process post-loop no remaining processes"
    return $true
  }

  $orderedRemainingIds = @($remainingIds) | Sort-Object -Descending
  Write-CleanupLog -Message "stop-process post-loop remaining=$($orderedRemainingIds.Count) ids=$([string]::Join(',', $orderedRemainingIds))"

  foreach ($processId in $orderedRemainingIds) {
    $null = & taskkill.exe /PID $processId /T /F 2>&1
    Write-CleanupLog -Message "stop-process fallback-taskkill pid=$processId exit=$LASTEXITCODE"
  }

  Start-Sleep -Milliseconds $delayMilliseconds

  $finalProcessMap = Get-ProcessMap
  $finalIds = @(Get-InstallRootRelatedProcessIds -ProcessMap $finalProcessMap)
  if ($finalIds.Count -gt 0) {
    $orderedFinalIds = @($finalIds) | Sort-Object -Descending
    Write-CleanupLog -Message "stop-process final remaining=$($orderedFinalIds.Count) ids=$([string]::Join(',', $orderedFinalIds))"
    return $false
  }

  Write-CleanupLog -Message "stop-process final no remaining processes"
  return $true
}

function Clear-ReadOnlyAttributes {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $null = & attrib -R "$Path\*" /S /D 2>$null
}

function Remove-PathWithRetries {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$MaxAttempts = 8,
    [int]$DelayMilliseconds = 500
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    if (-not (Test-Path -LiteralPath $Path)) {
      Write-CleanupLog -Message "remove-path path=$Path status=already-absent"
      return $true
    }

    try {
      Clear-ReadOnlyAttributes -Path $Path
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    }
    catch {
      Write-CleanupLog -Message "remove-path path=$Path attempt=$attempt remove-item-error=$($_.Exception.Message)"
    }

    if (Test-Path -LiteralPath $Path) {
      $quotedPath = '"' + $Path.Replace('"', '""') + '"'
      $null = & cmd.exe /d /s /c "rmdir /s /q $quotedPath >NUL 2>&1"
      if ($LASTEXITCODE -ne 0) {
        Write-CleanupLog -Message "remove-path path=$Path attempt=$attempt rmdir-exit=$LASTEXITCODE"
      }
    }

    if (-not (Test-Path -LiteralPath $Path)) {
      Write-CleanupLog -Message "remove-path path=$Path status=removed attempt=$attempt"
      return $true
    }

    Start-Sleep -Milliseconds $DelayMilliseconds
  }

  Write-CleanupLog -Message "remove-path path=$Path status=failed attempts=$MaxAttempts"
  return (-not (Test-Path -LiteralPath $Path))
}

function Remove-TopLevelNodeModulesLinks {
  if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
    return
  }

  $entries = @(Get-ChildItem -LiteralPath $nodeModulesPath -Force -ErrorAction SilentlyContinue)
  foreach ($entry in $entries) {
    if (-not ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
      continue
    }

    try {
      Remove-Item -LiteralPath $entry.FullName -Recurse -Force -ErrorAction Stop
      Write-CleanupLog -Message "remove-link path=$($entry.FullName) status=removed"
    }
    catch {
      Write-CleanupLog -Message "remove-link path=$($entry.FullName) status=failed error=$($_.Exception.Message)"
    }
  }
}

function Invoke-NodeModulesCleanup {
  Write-CleanupLog -Message "cleanup-start nodeModules=$nodeModulesPath pnpm=$pnpmStorePath"
  Remove-TopLevelNodeModulesLinks
  $null = Remove-PathWithRetries -Path $pnpmStorePath -MaxAttempts 10 -DelayMilliseconds 500
  $null = Remove-PathWithRetries -Path $nodeModulesPath -MaxAttempts 6 -DelayMilliseconds 500
  $null = Remove-PathWithRetries -Path $appRootPath -MaxAttempts 4 -DelayMilliseconds 500
  Write-CleanupLog -Message "cleanup-finish"
}

Write-CleanupLog -Message "script-start pid=$PID cleanupNodeModules=$CleanupNodeModules installRoot=$installRoot"

try {
  $processesStopped = Stop-InstallRootProcesses
  Write-CleanupLog -Message "stop-processes-finish success=$processesStopped"
}
catch {
  Write-CleanupLog -Message "stop-processes-failed error=$($_.Exception.Message)"
}

if ($CleanupNodeModules) {
  try {
    Invoke-NodeModulesCleanup
  }
  catch {
    Write-CleanupLog -Message "cleanup-failed error=$($_.Exception.Message)"
  }
}

try {
  if ($CleanupNodeModules) {
    $existsAfterCleanup = Test-Path -LiteralPath $nodeModulesPath
    Write-CleanupLog -Message "script-finish nodeModulesExists=$existsAfterCleanup"
  }
}
catch {
  # Best effort logging only.
}
