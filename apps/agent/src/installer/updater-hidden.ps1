Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$logsDir = Join-Path $dataRoot 'logs'
$nodeExePath = Join-Path $installRoot 'node\node.exe'
$registerAliasLoaderPath = Join-Path $installRoot 'app\dist\apps\agent\src\runtime\register-alias-loader.js'
$updaterScriptPath = Join-Path $installRoot 'app\dist\apps\agent\src\updater.js'
$updaterOutLogPath = Join-Path $logsDir 'updater.out.log'
$updaterErrLogPath = Join-Path $logsDir 'updater.err.log'
$registerAliasLoaderUrl = $null

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

try {
  if (-not (Test-Path -LiteralPath $nodeExePath)) {
    throw "node.exe not found at $nodeExePath"
  }

  if (-not (Test-Path -LiteralPath $registerAliasLoaderPath)) {
    throw "register-alias-loader.js not found at $registerAliasLoaderPath"
  }

  $registerAliasLoaderUrl = [System.Uri]::new($registerAliasLoaderPath).AbsoluteUri

  if (-not (Test-Path -LiteralPath $updaterScriptPath)) {
    throw "updater.js not found at $updaterScriptPath"
  }

  Ensure-FileExists -Path $updaterOutLogPath
  Ensure-FileExists -Path $updaterErrLogPath

  & $nodeExePath '--import' $registerAliasLoaderUrl $updaterScriptPath 1>> $updaterOutLogPath 2>> $updaterErrLogPath
  exit $LASTEXITCODE
} catch {
  try {
    Ensure-FileExists -Path $updaterErrLogPath
    Add-Content -Path $updaterErrLogPath -Value ("[{0}] {1}" -f [DateTime]::UtcNow.ToString('o'), $_.Exception.Message)
  } catch {
    # ignore fallback logging failures
  }

  exit 1
}
