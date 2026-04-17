import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE_FILES_USING_STATE_STORE = [
  'apps/agent/src/control-core/agent-control-core.ts',
  'apps/agent/src/control-core/local-control-service.ts',
  'apps/agent/src/control-core/public-control-files.ts',
  'apps/agent/src/control-core/public-control-state.ts',
  'apps/agent/src/log-forwarder.ts',
  'apps/agent/src/pending-activity.ts',
  'apps/agent/src/runtime/infrastructure/supervisor-control.repository.ts',
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('state ownership boundaries', () => {
  it('routes canonical state persistence through @agent/state infrastructure APIs', () => {
    for (const relativePath of SOURCE_FILES_USING_STATE_STORE) {
      const source = readSource(relativePath)
      expect(source).toContain('@agent/state/infrastructure/json-state.file-store')
    }
  })

  it('keeps linux local restart signaling delegated to supervisor-control repository', () => {
    const source = readSource('apps/agent/src/platform/control/linux-dev-process-control.ts')
    expect(source).toContain('writeSupervisorControl(')
    expect(source).not.toMatch(/fs\.writeFileSync\(\s*supervisorControlPath/u)
  })
})
