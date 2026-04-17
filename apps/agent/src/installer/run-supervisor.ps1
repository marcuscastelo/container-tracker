Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$dataRoot = Join-Path $env:LOCALAPPDATA 'ContainerTracker'
$logsDir = Join-Path $dataRoot 'logs'
$nodeExePath = Join-Path $installRoot 'node\node.exe'
$registerAliasLoaderPath = Join-Path $installRoot 'app\dist\apps\agent\src\runtime\register-alias-loader.js'
$supervisorScriptPath = Join-Path $installRoot 'app\dist\apps\agent\src\supervisor.js'
$supervisorLogPath = Join-Path $logsDir 'supervisor.log'
$registerAliasLoaderUrl = $null

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

function Write-PathProbe {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $exists = Test-Path -LiteralPath $Path
  if (-not $exists) {
    Write-SupervisorLauncherLog -Message "$Label path missing: $Path"
    return
  }

  $item = Get-Item -LiteralPath $Path
  $type = if ($item.PSIsContainer) { 'directory' } else { 'file' }
  Write-SupervisorLauncherLog -Message "$Label path ok type=$type value=$Path"
}

try {
  Write-SupervisorLauncherLog -Message "launcher context pid=$PID user=$env:USERNAME host=$env:COMPUTERNAME powershell=$($PSVersionTable.PSVersion) cwd=$(Get-Location)"
  Write-SupervisorLauncherLog -Message "launcher environment LOCALAPPDATA=$env:LOCALAPPDATA AGENT_DATA_DIR=$env:AGENT_DATA_DIR DOTENV_PATH=$env:DOTENV_PATH BOOTSTRAP_DOTENV_PATH=$env:BOOTSTRAP_DOTENV_PATH AGENT_PUBLIC_STATE_DIR=$env:AGENT_PUBLIC_STATE_DIR"
  Write-PathProbe -Label 'install-root' -Path $installRoot
  Write-PathProbe -Label 'data-root' -Path $dataRoot
  Write-PathProbe -Label 'logs-dir' -Path $logsDir
  Write-PathProbe -Label 'node-exe' -Path $nodeExePath
  Write-PathProbe -Label 'alias-loader' -Path $registerAliasLoaderPath
  Write-PathProbe -Label 'supervisor-script' -Path $supervisorScriptPath

  if (-not (Test-Path -LiteralPath $nodeExePath)) {
    throw "node.exe not found at $nodeExePath"
  }

  if (-not (Test-Path -LiteralPath $registerAliasLoaderPath)) {
    throw "register-alias-loader.js not found at $registerAliasLoaderPath"
  }

  $registerAliasLoaderUrl = [System.Uri]::new($registerAliasLoaderPath).AbsoluteUri

  if (-not (Test-Path -LiteralPath $supervisorScriptPath)) {
    throw "supervisor.js not found at $supervisorScriptPath"
  }

  Ensure-Directory -Path $logsDir
  Write-SupervisorLauncherLog -Message 'starting installed supervisor entrypoint'
  Write-SupervisorLauncherLog -Message "launch command: `"$nodeExePath`" --import `"$registerAliasLoaderUrl`" `"$supervisorScriptPath`""

  Push-Location $installRoot
  try {
    & $nodeExePath '--import' $registerAliasLoaderUrl $supervisorScriptPath
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  if ($null -eq $exitCode) {
    $exitCode = 0
  }

  Write-SupervisorLauncherLog -Message "supervisor process exited with code $exitCode"
  if ($exitCode -ne 0) {
    $agentOutPath = Join-Path $logsDir 'agent.out.log'
    $agentErrPath = Join-Path $logsDir 'agent.err.log'
    Write-SupervisorLauncherLog -Message "non-zero supervisor exit detected; inspect runtime logs out=$agentOutPath err=$agentErrPath"
    Write-PathProbe -Label 'agent-out-log' -Path $agentOutPath
    Write-PathProbe -Label 'agent-err-log' -Path $agentErrPath
  }
  exit $exitCode
}
catch {
  try {
    $exceptionMessage = $_.Exception.Message
    $stackTrace = $_.ScriptStackTrace
    if ([string]::IsNullOrWhiteSpace($stackTrace)) {
      Write-SupervisorLauncherLog -Message "launcher fatal error: $exceptionMessage"
    }
    else {
      Write-SupervisorLauncherLog -Message "launcher fatal error: $exceptionMessage`n$stackTrace"
    }
  }
  catch {
    # Best effort logging only.
  }

  exit 1
}
