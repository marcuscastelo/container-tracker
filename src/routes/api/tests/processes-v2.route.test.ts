import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  listProcessesV2: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    listProcessesV2: processHandlers.listProcessesV2,
  },
}))

import { GET as processesV2Get } from '~/routes/api/processes-v2'

describe('processes-v2 route', () => {
  it('binds GET /api/processes-v2 to process list v2 controller', () => {
    expect(processesV2Get).toBe(processHandlers.listProcessesV2)
  })
})
