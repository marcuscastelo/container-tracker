import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveRuntimeExecArgv } from '@agent/supervisor/supervisor.entry'
import { describe, expect, it } from 'vitest'

describe('supervisor runtime alias loader resolution', () => {
  it('loads the sibling runtime/register-alias-loader.js for the fallback agent wrapper', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-loader-'))
    const scriptPath = path.join(baseDir, 'apps', 'agent', 'src', 'agent.js')
    const registerPath = path.join(
      baseDir,
      'apps',
      'agent',
      'src',
      'runtime',
      'register-alias-loader.js',
    )

    fs.mkdirSync(path.dirname(registerPath), { recursive: true })
    fs.writeFileSync(scriptPath, '', 'utf8')
    fs.writeFileSync(registerPath, '', 'utf8')

    expect(resolveRuntimeExecArgv(scriptPath)).toEqual([
      `--import=${pathToFileURL(registerPath).href}`,
    ])
  })
})
