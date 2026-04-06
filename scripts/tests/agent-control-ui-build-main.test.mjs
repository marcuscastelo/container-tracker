import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { rewriteEmittedImports } from '../agent-control-ui/rewrite-emitted-imports.mjs'

function makeTempDistRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-control-ui-build-main-'))
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents, 'utf8')
}

describe('rewriteEmittedImports', () => {
  it('rewrites emitted @tools imports to relative output paths', () => {
    const distRoot = makeTempDistRoot()
    const mainPath = path.join(distRoot, 'tools', 'agent-control-ui', 'main.js')
    const ipcPath = path.join(distRoot, 'tools', 'agent-control-ui', 'ipc.js')
    const contractsPath = path.join(distRoot, 'tools', 'agent', 'control-core', 'contracts.js')

    writeFile(
      mainPath,
      [
        "import { value } from '@tools/agent-control-ui/ipc';",
        "import { schema } from '@tools/agent/control-core/contracts';",
        '',
      ].join('\n'),
    )
    writeFile(ipcPath, 'export const value = 1;\n')
    writeFile(contractsPath, 'export const schema = {};\n')

    const result = rewriteEmittedImports({ distRoot })
    const rewrittenMain = fs.readFileSync(mainPath, 'utf8')

    expect(result.rewrittenFiles).toBe(1)
    expect(result.rewrittenImports).toBe(2)
    expect(rewrittenMain).toContain("from './ipc.js'")
    expect(rewrittenMain).toContain("from '../agent/control-core/contracts.js'")
    expect(rewrittenMain).not.toContain('@tools/')
  })
})
