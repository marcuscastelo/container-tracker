Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$logsDir = Join-Path $dataRoot 'logs'
$nodeExePath = Join-Path $installRoot 'node\node.exe'
$registerAliasLoaderPath = Join-Path $installRoot 'app\dist\tools\agent\runtime\register-alias-loader.js'
$supervisorScriptPath = Join-Path $installRoot 'app\dist\tools\agent\supervisor.js'
$supervisorLogPath = Join-Path $logsDir 'supervisor.log'

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-SupervisorLauncherLog {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Ensure-Directory -Path $logsDir
  $line = '[{0}] [supervisor-launcher] {1}' -f [DateTime]::UtcNow.ToString('o'), $Message
  Add-Content -Path $supervisorLogPath -Value $line
}

try {
  if (-not (Test-Path -LiteralPath $nodeExePath)) {
    throw "node.exe not found at $nodeExePath"
  }

  if (-not (Test-Path -LiteralPath $registerAliasLoaderPath)) {
    throw "register-alias-loader.js not found at $registerAliasLoaderPath"
  }

  if (-not (Test-Path -LiteralPath $supervisorScriptPath)) {
    throw "supervisor.js not found at $supervisorScriptPath"
  }

  Ensure-Directory -Path $logsDir
  Write-SupervisorLauncherLog -Message 'starting installed supervisor entrypoint'

  Push-Location $installRoot
  try {
    & $nodeExePath '--import' $registerAliasLoaderPath $supervisorScriptPath
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  if ($null -eq $exitCode) {
    $exitCode = 0
  }

  Write-SupervisorLauncherLog -Message "supervisor process exited with code $exitCode"
  exit $exitCode
}
catch {
  try {
    Write-SupervisorLauncherLog -Message $_.Exception.Message
  }
  catch {
    # Best effort logging only.
  }

  exit 1
}
