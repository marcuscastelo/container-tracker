# Agent Installer (Windows x64)

This flow builds a Windows installer for the Agent service and updater stub.

## 1) Build release folder

```bash
pnpm run agent:release
```

`agent:release` runs:

1. TypeScript build for `tools/agent/*`
2. `release/` assembly (Node runtime + app + WinSW + config template)
3. Pre-flight fail-fast checks (`preflight ok` only when all checks pass)

## 2) Build `Setup.exe` (Windows)

Install Inno Setup and run:

```bash
pnpm run agent:setup
```

Installer script: `tools/agent/installer/installer.iss`

## 3) Installed locations

- Program files: `C:\Program Files\ContainerTrackerAgent\`
- Config: `C:\ProgramData\ContainerTrackerAgent\config.env`
- Logs: `C:\ProgramData\ContainerTrackerAgent\logs\`

## 4) Runtime behavior

- Service name: `ContainerTrackerAgent` (WinSW)
- Updater task: `ContainerTrackerAgentUpdater` (every 30 minutes, `SYSTEM`)
- Updater mode (MVP): logs version/timestamp and `NO UPDATES (stub mode)`

## 5) Edit config

Edit:

`C:\ProgramData\ContainerTrackerAgent\config.env`

Then restart service:

```bat
sc stop ContainerTrackerAgent
sc start ContainerTrackerAgent
```

## 6) Operational commands

```bat
sc query ContainerTrackerAgent
schtasks /Query /TN ContainerTrackerAgentUpdater /V /FO LIST
"C:\Program Files\ContainerTrackerAgent\winsw\ContainerTrackerAgent.exe" status
```

## 7) Important notes

- Installer is x64-only.
- If `MAERSK_ENABLED=1`, installer blocks when Chrome/Chromium is missing.
- Without code signing, Windows SmartScreen warnings may appear.
