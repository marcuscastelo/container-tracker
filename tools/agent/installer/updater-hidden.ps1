Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$logsDir = Join-Path $dataRoot 'logs'
$nodeExePath = Join-Path $installRoot 'node\node.exe'
$updaterScriptPath = Join-Path $installRoot 'app\dist\updater.js'
$updaterOutLogPath = Join-Path $logsDir 'updater.out.log'
$updaterErrLogPath = Join-Path $logsDir 'updater.err.log'

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

try {
  if (-not (Test-Path -LiteralPath $nodeExePath)) {
    throw "node.exe not found at $nodeExePath"
  }

  if (-not (Test-Path -LiteralPath $updaterScriptPath)) {
    throw "updater.js not found at $updaterScriptPath"
  }

  Ensure-FileExists -Path $updaterOutLogPath
  Ensure-FileExists -Path $updaterErrLogPath

  $nodeExeQuoted = Convert-ToCmdQuoted -Value $nodeExePath
  $updaterScriptQuoted = Convert-ToCmdQuoted -Value $updaterScriptPath
  $outLogQuoted = Convert-ToCmdQuoted -Value $updaterOutLogPath
  $errLogQuoted = Convert-ToCmdQuoted -Value $updaterErrLogPath

  $updaterCommand = "$nodeExeQuoted $updaterScriptQuoted 1>>$outLogQuoted 2>>$errLogQuoted"
  $cmdArguments = @(
    '/d',
    '/s',
    '/c',
    "`"$updaterCommand`""
  )

  $process = Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList $cmdArguments `
    -WindowStyle Hidden `
    -PassThru `
    -Wait

  exit $process.ExitCode
} catch {
  try {
    Ensure-FileExists -Path $updaterErrLogPath
    Add-Content -Path $updaterErrLogPath -Value ("[{0}] {1}" -f [DateTime]::UtcNow.ToString('o'), $_.Exception.Message)
  } catch {
    # ignore fallback logging failures
  }

  exit 1
}
