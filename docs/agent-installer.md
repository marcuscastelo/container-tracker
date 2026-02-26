# Agent Installer (Windows x64, One-Click)

This document defines the canonical one-click flow for the Windows Agent installer.

## TL;DR (UX)

- User runs `Setup.exe`.
- Installer shows normal progress and completes.
- Service starts automatically.
- Internet is not required for installation success.
- If offline, service stays alive and keeps retrying enrolment until success.

## Build installer artifacts

### 1) Build release folder

```bash
pnpm run agent:release
```

`agent:release` runs:

1. TypeScript build for `tools/agent/*`
2. `release/` assembly (Node runtime + app + WinSW + bootstrap config)
3. preflight checks (`preflight ok` only when all checks pass)

### 2) Build transfer bundle (Linux -> Windows)

```bash
pnpm run agent:bundle
```

Output: `dist/agent-installer-bundle.zip`

Bundle content: `release/` plus `tools/agent/installer/*` so Windows only needs unzip + `iscc`.

### 3) Build `Setup.exe` (Windows)

```bash
pnpm run agent:setup
```

Installer script: `tools/agent/installer/installer.iss`

## What the user sees

- Standard installer flow only.
- No sensitive field prompts.
- No request for tenant id, agent token, or Supabase keys.
- No manual file editing as part of the default flow.

## What the installer does (no network)

Installer never calls the internet.

- Copies binaries to `C:\Program Files\ContainerTrackerAgent\`
- Ensures `C:\ProgramData\ContainerTrackerAgent\`
- Ensures `C:\ProgramData\ContainerTrackerAgent\logs\`
- Copies `bootstrap.env` to ProgramData
- Installs WinSW service `ContainerTrackerAgent`
- Optionally creates updater task `ContainerTrackerAgentUpdater` every 30 minutes (`SYSTEM`)
- Starts service automatically
- On uninstall: removes service and updater task, preserves ProgramData

## Runtime startup behavior (service)

Service boot mode is selected at runtime:

1. If `C:\ProgramData\ContainerTrackerAgent\config.env` exists and parses: normal mode.
2. Otherwise: bootstrap mode.

Bootstrap mode:

1. Load `bootstrap.env` (`BACKEND_URL`, `INSTALLER_TOKEN`, defaults).
2. Call `POST /api/agent/enroll` using `INSTALLER_TOKEN`.
3. If success:
   - persist full `config.env` to ProgramData
   - optionally delete or rename `bootstrap.env` to reduce exposure
   - switch to normal mode
4. If failure:
   - do not crash service
   - log sanitized error (never print tokens)
   - retry with exponential backoff + cap

Default retry policy for enrolment:

- base delay: `5s`
- factor: `2`
- cap: `300s`
- jitter: `20%`
- retries: unlimited until success

## Installed locations

- Program files: `C:\Program Files\ContainerTrackerAgent\`
- Bootstrap: `C:\ProgramData\ContainerTrackerAgent\bootstrap.env`
- Effective config: `C:\ProgramData\ContainerTrackerAgent\config.env`
- Logs: `C:\ProgramData\ContainerTrackerAgent\logs\`

## States and troubleshooting

### No internet (DNS/timeout)

- Installation still succeeds.
- Service stays running.
- Logs show enrolment retry loop with backoff.

### Token invalid or revoked

- Service does not crash.
- Logs show unauthorized response in sanitized form.
- Service keeps retrying until token is fixed/rotated.

### Backend unavailable (5xx/network edge)

- Service does not crash.
- Retry loop continues with exponential backoff and cap.

### Corrupted `config.env`

- Service falls back to bootstrap mode.
- Attempts re-enrolment and rewrites valid config after success.

### Missing or invalid `bootstrap.env`

- Service remains alive.
- Logs show bootstrap parse/load failure.
- Service re-evaluates periodically and retries.

## Optional automation

`/CFG_FILE` may exist for internal automation, but it is not the primary user flow.

## Operational commands

```bat
sc query ContainerTrackerAgent
schtasks /Query /TN ContainerTrackerAgentUpdater /V /FO LIST
"C:\Program Files\ContainerTrackerAgent\winsw\ContainerTrackerAgent.exe" status
```

## Migration map (old plan -> one-click runtime enrolment)

- Wizard env form -> no sensitive wizard fields; runtime enrolment
- Build-time `config.env` from repo `.env` -> bundled `bootstrap.env` + runtime `POST /api/agent/enroll`
- Required `SUPABASE_URL` and `SUPABASE_ANON_KEY` -> optional in effective config
- `/CFG_FILE` primary path -> `/CFG_FILE` optional internal automation
- Manual edit of `config.env` as default -> removed from primary flow

## Coherence checklist

- Installer never fails because of network.
- Service enrols itself at runtime.
- No sensitive wizard fields.
- Supabase stays optional.
- Logs never print `INSTALLER_TOKEN` or `AGENT_TOKEN`.

## Important notes

- Installer is x64-only.
- Updater is still stub in MVP.
- Without code signing, Windows SmartScreen warnings may appear.
