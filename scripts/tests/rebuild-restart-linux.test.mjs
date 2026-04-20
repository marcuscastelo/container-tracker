import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptPath = path.join(repoRoot, 'scripts', 'agent', 'rebuild-restart-linux.sh')
const describeOnLinuxShellHost = process.platform === 'win32' ? describe.skip : describe

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8')
  fs.chmodSync(filePath, 0o755)
}

function writeProcEnviron(filePath, values) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${values.join('\u0000')}\u0000`, 'utf8')
}

function createPackagingSourceTree(tempDir) {
  const pkgDir = path.join(tempDir, 'packaging', 'arch')
  fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true })

  const linkNames = [
    'container-tracker-agent-admin.launcher',
    'container-tracker-agent-tray.desktop',
    'container-tracker-agent-tray.launcher',
    'container-tracker-agent-ui.desktop',
    'container-tracker-agent-ui.launcher',
    'container-tracker-agent.install',
    'container-tracker-agent.launcher',
    'container-tracker-agent.service',
    'container-tracker-agent.sysusers',
    'container-tracker-agent.tmpfiles',
  ]

  for (const linkName of linkNames) {
    const targetPath = path.join(pkgDir, linkName)
    fs.writeFileSync(targetPath, `${linkName}\n`, 'utf8')
    fs.symlinkSync(targetPath, path.join(pkgDir, 'src', linkName))
  }

  return { linkNames, pkgDir }
}

describeOnLinuxShellHost('rebuild-restart-linux tray restart', () => {
  it('kills only tray-mode Electron processes and avoids matching the wrapper path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuild-restart-linux-'))
    const binDir = path.join(tempDir, 'bin')
    const procRoot = path.join(tempDir, 'proc')
    const killCapturePath = path.join(tempDir, 'kill.txt')
    const pgrepCapturePath = path.join(tempDir, 'pgrep.txt')

    fs.mkdirSync(binDir, { recursive: true })
    fs.writeFileSync(killCapturePath, '', 'utf8')

    writeExecutable(
      path.join(binDir, 'id'),
      `#!/usr/bin/env bash
printf '1000'
`,
    )
    writeExecutable(
      path.join(binDir, 'pgrep'),
      `#!/usr/bin/env bash
printf '%s\\n' "$*" > "$PGREP_CAPTURE_PATH"
printf '111\\n222\\n'
`,
    )
    writeExecutable(
      path.join(binDir, 'ct-agent-tray'),
      `#!/usr/bin/env bash
exit 0
`,
    )

    writeProcEnviron(path.join(procRoot, '111', 'environ'), [
      'CT_AGENT_UI_MODE=tray',
      'CT_AGENT_UI_INSTALLED=1',
    ])
    writeProcEnviron(path.join(procRoot, '222', 'environ'), [
      'CT_AGENT_UI_MODE=window',
      'CT_AGENT_UI_INSTALLED=1',
    ])

    const result = spawnSync(
      'bash',
      [
        '-lc',
        `source "$SCRIPT_PATH"
kill() {
  printf '%s\\n' "$*" >> "$KILL_CAPTURE_PATH"
}
sleep() {
  :
}
restart_tray_for_current_session
`,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CT_AGENT_PROC_ROOT: procRoot,
          DISPLAY: ':0',
          HOME: tempDir,
          KILL_CAPTURE_PATH: killCapturePath,
          PATH: [binDir, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
          PGREP_CAPTURE_PATH: pgrepCapturePath,
          SCRIPT_PATH: scriptPath,
          XDG_CACHE_HOME: path.join(tempDir, 'cache'),
        },
      },
    )

    expect(result.status).toBe(0)
    expect(fs.readFileSync(pgrepCapturePath, 'utf8')).toContain(
      '/usr/lib/container-tracker-agent/dist/apps/agent/control-ui',
    )
    expect(fs.readFileSync(pgrepCapturePath, 'utf8')).not.toContain('/usr/bin/ct-agent-tray')
    expect(fs.readFileSync(killCapturePath, 'utf8')).toContain('111')
    expect(fs.readFileSync(killCapturePath, 'utf8')).not.toContain('222')
  })

  it('normalizes packaging symlinks back to relative targets after makepkg rewrites them', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuild-restart-linux-links-'))
    const { linkNames, pkgDir } = createPackagingSourceTree(tempDir)

    const result = spawnSync(
      'bash',
      [
        '-lc',
        `source "$SCRIPT_PATH"
pkg_dir="$PKG_DIR"
normalize_packaging_source_links
`,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PKG_DIR: pkgDir,
          SCRIPT_PATH: scriptPath,
        },
      },
    )

    expect(result.status).toBe(0)

    for (const linkName of linkNames) {
      expect(fs.readlinkSync(path.join(pkgDir, 'src', linkName))).toBe(`../${linkName}`)
    }
  })

  it('does not inject a backend URL default when no BACKEND_URL is provided', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuild-restart-linux-default-url-'))
    const envFilePath = path.join(tempDir, '.env')
    fs.writeFileSync(envFilePath, '\n', 'utf8')

    const result = spawnSync(
      'bash',
      [
        '-lc',
        `source "$SCRIPT_PATH"
backend_url="$(first_non_empty \
  "$(read_env_value "$PROJECT_ENV_PATH" BACKEND_URL AGENT_BACKEND_URL || true)" \
  "\${AGENT_BACKEND_URL:-}" \
  "\${BACKEND_URL:-}")"
printf '%s' "$backend_url"
`,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PROJECT_ENV_PATH: envFilePath,
          SCRIPT_PATH: scriptPath,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('')
  })

  it('fails fast when BACKEND_URL is missing even if INSTALLER_TOKEN exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuild-restart-linux-missing-backend-'))
    const envFilePath = path.join(tempDir, '.env')
    fs.writeFileSync(envFilePath, 'INSTALLER_TOKEN=test-token\n', 'utf8')

    const result = spawnSync(
      'bash',
      [
        '-lc',
        `source "$SCRIPT_PATH"
project_env_path="$PROJECT_ENV_PATH"
main
`,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PROJECT_ENV_PATH: envFilePath,
          SCRIPT_PATH: scriptPath,
        },
      },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('BACKEND_URL is required')
  })
})
