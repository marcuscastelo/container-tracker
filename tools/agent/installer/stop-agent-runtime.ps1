Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ContainerTrackerAgent'
$normalizedInstallRoot = $installRoot.ToLowerInvariant()

try {
  $candidateProcesses = @(
    Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $commandLineMatch = $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($normalizedInstallRoot)
      $executablePathMatch = $_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().StartsWith($normalizedInstallRoot)
      return $commandLineMatch -or $executablePathMatch
    }
  )

  foreach ($candidateProcess in $candidateProcesses) {
    Stop-Process -Id $candidateProcess.ProcessId -Force -ErrorAction SilentlyContinue
  }
} catch {
  # Best-effort runtime stop; ignore failures to avoid blocking installer flows.
}
