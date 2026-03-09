param(
  [switch]$CleanupNodeModules
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$normalizedInstallRoot = $installRoot.ToLowerInvariant()
$nodeModulesPath = Join-Path $installRoot 'app\node_modules'
$pnpmStorePath = Join-Path $nodeModulesPath '.pnpm'

function Test-IsInstallRootProcess {
  param(
    [Parameter(Mandatory = $true)]
    [object]$ProcessRecord
  )

  $commandLine = if ($ProcessRecord.CommandLine) {
    $ProcessRecord.CommandLine.ToLowerInvariant()
  } else {
    ''
  }

  $executablePath = if ($ProcessRecord.ExecutablePath) {
    $ProcessRecord.ExecutablePath.ToLowerInvariant()
  } else {
    ''
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

  return $relatedProcessIds
}

function Stop-InstallRootProcesses {
  $maxAttempts = 6

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $processMap = Get-ProcessMap
    $relatedProcessIds = Get-InstallRootRelatedProcessIds -ProcessMap $processMap
    if ($relatedProcessIds.Count -eq 0) {
      return
    }

    $orderedIds = @($relatedProcessIds) | Sort-Object -Descending
    foreach ($processId in $orderedIds) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 300
  }
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
      return $true
    }

    try {
      Clear-ReadOnlyAttributes -Path $Path
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    } catch {
      # Retry with cmd fallback below.
    }

    if (Test-Path -LiteralPath $Path) {
      $quotedPath = '"' + $Path.Replace('"', '""') + '"'
      $null = & cmd.exe /d /s /c "rmdir /s /q $quotedPath >NUL 2>&1"
    }

    if (-not (Test-Path -LiteralPath $Path)) {
      return $true
    }

    Start-Sleep -Milliseconds $DelayMilliseconds
  }

  return (-not (Test-Path -LiteralPath $Path))
}

function Invoke-NodeModulesCleanup {
  $null = Remove-PathWithRetries -Path $pnpmStorePath -MaxAttempts 10 -DelayMilliseconds 500
  $null = Remove-PathWithRetries -Path $nodeModulesPath -MaxAttempts 6 -DelayMilliseconds 500
}

try {
  Stop-InstallRootProcesses

  if ($CleanupNodeModules) {
    Invoke-NodeModulesCleanup
  }
} catch {
  # Best-effort runtime stop/cleanup; ignore failures to avoid blocking installer flows.
}
