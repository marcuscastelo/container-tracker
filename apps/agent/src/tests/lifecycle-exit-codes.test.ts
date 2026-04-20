import {
  EXIT_CONFIG_ERROR,
  EXIT_OK,
  EXIT_UPDATE_RESTART,
  resolveSupervisorExitAction,
} from '@agent/runtime/lifecycle-exit-codes'
import { describe, expect, it } from 'vitest'

describe('supervisor lifecycle exit-code mapping', () => {
  it('maps update restart exit code to restart action', () => {
    expect(resolveSupervisorExitAction(EXIT_UPDATE_RESTART)).toBe('restart-for-update')
  })

  it('maps graceful exit code to stop action', () => {
    expect(resolveSupervisorExitAction(EXIT_OK)).toBe('stop-graceful')
  })

  it('maps configuration error exit code to stop-without-restart action', () => {
    expect(resolveSupervisorExitAction(EXIT_CONFIG_ERROR)).toBe('stop-config-error')
  })

  it('maps unknown non-zero exit codes to restart after failure', () => {
    expect(resolveSupervisorExitAction(1)).toBe('restart-after-failure')
    expect(resolveSupervisorExitAction(null)).toBe('restart-after-failure')
  })
})
