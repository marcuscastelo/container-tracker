# Agent Installer (Windows x64, Per-User)

This document defines the canonical one-click flow for the Windows Agent installer.

## TL;DR (UX)

- User runs `Setup.exe` without elevation.
- If `MAERSK_ENABLED=1`, installer shows a dependency checklist for Chrome/Chromium.
  - If Chrome is already installed, checkbox appears pre-checked.
  - If Chrome is missing, user can check to trigger automatic install via `winget`.
- Installer completes and configures per-user auto-start tasks.
- Runtime enrollment retries continue while backend is unreachable.

## Build installer artifacts

### 1) Build release folder

```bash
pnpm run agent:release
```

`agent:release` runs:

1. TypeScript build for `tools/agent/*`
2. `release/` assembly (Node runtime + app + bootstrap config)
3. preflight checks (`preflight ok` only when all checks pass)

### 2) Build transfer bundle (Linux -> Windows)

```bash
pnpm run agent:bundle
```

Output: `dist/agent-installer-bundle.zip`

Bundle content: `release/` plus `tools/agent/installer/*`.

### 3) Build `Setup.exe` (Windows or Linux)

```bash
pnpm run agent:setup
```

Installer script: `tools/agent/installer/installer.iss`

Default strategy (`agent:setup`) is:

1. native `iscc` (if available)
2. Docker (`amake/innosetup`)
3. Wine + local `ISCC.exe`

Optional explicit modes:

```bash
pnpm run agent:setup:native
pnpm run agent:setup:docker
pnpm run agent:setup:wine
```

Optional env vars:

- `AGENT_SETUP_MODE=auto|native|docker|wine`
- `AGENT_SETUP_DOCKER_IMAGE=<image>`
- `AGENT_SETUP_WINE_ISCC_PATH=<path-to-ISCC.exe>`

### 4) Linux E2E simulation (runtime wiring)

```bash
pnpm run agent:e2e:linux
```

This command simulates setup effects on Linux:

- materializes a per-user layout under `/tmp/.../LocalAppData`
- writes `bootstrap.env`, runs agent, performs runtime enrollment against a local mock backend
- validates generated `config.env`, consumed bootstrap redaction, and authenticated target polling
- fails if any created path contains `ProgramData`

Use this during development to validate installer/runtime wiring and enrollment behavior.

## What the installer does

Installer does not require internet for the core install flow.
If automatic Chrome install is selected on the dependency page, setup calls `winget` and may use the internet.

- Copies binaries to `%LOCALAPPDATA%\Programs\ContainerTrackerAgent\`
- Ensures `%LOCALAPPDATA%\ContainerTracker\`
- Ensures `%LOCALAPPDATA%\ContainerTracker\logs\`
- Ensures `%LOCALAPPDATA%\ContainerTracker\releases\`
- Ensures `%LOCALAPPDATA%\ContainerTracker\downloads\`
- Ensures `%LOCALAPPDATA%\ContainerTracker\run\`
- Copies `bootstrap.env` to `%LOCALAPPDATA%\ContainerTracker\bootstrap.env`
- Creates per-user startup task `ContainerTrackerAgent`:
  - `Trigger=At logon`
  - `LogonType=InteractiveToken`
  - `RunLevel=LeastPrivilege`
- Creates per-user startup task `ContainerTrackerAgentUpdater` with the same constraints
- Triggers both tasks once after install
- On uninstall: removes both tasks and installed binaries (user data directory is preserved)

## Runtime startup behavior

Startup mode is selected at runtime:

1. If `%LOCALAPPDATA%\ContainerTracker\config.env` exists and parses: normal mode.
2. Otherwise: bootstrap mode.

Bootstrap mode:

1. Load `bootstrap.env` (`BACKEND_URL`, `INSTALLER_TOKEN`, defaults).
2. Call `POST /api/agent/enroll` using `INSTALLER_TOKEN`.
3. If success:
   - persist full `config.env`
   - rename `bootstrap.env` to `bootstrap.env.consumed` with token redacted
   - switch to normal mode
4. If failure:
   - do not crash process
   - log sanitized error (never print tokens)
   - retry with exponential backoff + cap

Default retry policy for enrollment:

- base delay: `5s`
- factor: `2`
- cap: `300s`
- jitter: `20%`
- retries: unlimited until success

## Installed locations

- Program files (per-user): `%LOCALAPPDATA%\Programs\ContainerTrackerAgent\`
- Bootstrap: `%LOCALAPPDATA%\ContainerTracker\bootstrap.env`
- Consumed bootstrap: `%LOCALAPPDATA%\ContainerTracker\bootstrap.env.consumed`
- Effective config: `%LOCALAPPDATA%\ContainerTracker\config.env`
- Logs: `%LOCALAPPDATA%\ContainerTracker\logs\`
- Runtime state: `%LOCALAPPDATA%\ContainerTracker\runtime-state.json`
- Release state: `%LOCALAPPDATA%\ContainerTracker\release-state.json`

## States and troubleshooting

### No internet (DNS/timeout)

- Installation still succeeds.
- Runtime task stays configured for logon.
- Logs show enrollment retry loop with backoff.

### Token invalid or revoked

- Runtime does not crash.
- Logs show unauthorized response in sanitized form.
- Runtime keeps retrying until token is fixed/rotated.

### Backend unavailable (5xx/network edge)

- Runtime does not crash.
- Retry loop continues with exponential backoff and cap.

### Corrupted `config.env`

- Runtime falls back to bootstrap mode.
- Attempts re-enrollment and rewrites valid config after success.

### Missing or invalid `bootstrap.env`

- Runtime remains alive.
- Logs show bootstrap parse/load failure.
- Runtime re-evaluates periodically and retries.

## Operational commands

```bat
schtasks /Query /TN ContainerTrackerAgent /V /FO LIST
schtasks /Query /TN ContainerTrackerAgentUpdater /V /FO LIST
```

## Coherence checklist

- Installer never fails because of network.
- Runtime enrolls itself at startup.
- No sensitive wizard fields.
- Supabase stays optional.
- Logs never print `INSTALLER_TOKEN` or `AGENT_TOKEN`.

## Important notes

- Installer is x64-only.
- Updater is still stub in MVP.
- Without code signing, Windows SmartScreen warnings may appear.
