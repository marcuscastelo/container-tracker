import { createWindowsLocalControlAdapter } from '@agent/platform/local-control.adapter'
import { describe, expect, it } from 'vitest'

describe('windows local control adapter helpers', () => {
  it('uses the Windows process-control adapter for lifecycle control', () => {
    expect(createWindowsLocalControlAdapter().key).toBe('windows')
  })
})
