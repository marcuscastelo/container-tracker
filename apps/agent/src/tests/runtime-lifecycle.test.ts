import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { clearRuntimeDrain, requestRuntimeDrain } from '@agent/runtime/application/drain-runtime'
import { shouldRollbackFromHealthGate } from '@agent/runtime/domain/runtime-health-policy'
import { readSupervisorControl } from '@agent/runtime/infrastructure/supervisor-control.repository'
import { describe, expect, it } from 'vitest'

describe('runtime lifecycle primitives', () => {
  it('writes and clears drain request in supervisor control state', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-runtime-lifecycle-test-'))
    const supervisorControlPath = path.join(tempDir, 'supervisor-control.json')

    requestRuntimeDrain({
      supervisorControlPath,
      reason: 'update',
      requestedAt: '2026-01-01T00:00:00.000Z',
    })

    const drainRequested = readSupervisorControl(supervisorControlPath)
    expect(drainRequested).toEqual({
      drain_requested: true,
      reason: 'update',
      requested_at: '2026-01-01T00:00:00.000Z',
    })

    clearRuntimeDrain(supervisorControlPath)
    expect(readSupervisorControl(supervisorControlPath)).toEqual({
      drain_requested: false,
      reason: null,
      requested_at: null,
    })
  })

  it('keeps health gate rollback policy deterministic for timeout/grace cases', () => {
    expect(
      shouldRollbackFromHealthGate({
        startupConfirmed: true,
        startupTimedOut: false,
        healthGraceConfirmed: true,
      }),
    ).toBe(false)

    expect(
      shouldRollbackFromHealthGate({
        startupConfirmed: false,
        startupTimedOut: true,
        healthGraceConfirmed: false,
      }),
    ).toBe(true)

    expect(
      shouldRollbackFromHealthGate({
        startupConfirmed: true,
        startupTimedOut: false,
        healthGraceConfirmed: false,
      }),
    ).toBe(true)
  })
})
