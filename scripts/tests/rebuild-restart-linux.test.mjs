import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptPath = path.join(repoRoot, 'scripts', 'agent', 'rebuild-restart-linux.sh')

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8')
  fs.chmodSync(filePath, 0o755)
}

function writeProcEnviron(filePath, values) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${values.join('\u0000')}\u0000`, 'utf8')
}

describe('rebuild-restart-linux tray restart', () => {
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

  it('falls back to castro-aduaneira backend URL when no BACKEND_URL is provided', () => {
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
  "\${BACKEND_URL:-}" \
  "$default_backend_url")"
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
    expect(result.stdout.trim()).toBe('https://castro-aduaneira.vercel.app/')
  })
})
