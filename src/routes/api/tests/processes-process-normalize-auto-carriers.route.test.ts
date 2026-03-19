import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  normalizeAutoCarriersByProcessId: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    normalizeAutoCarriersByProcessId: processHandlers.normalizeAutoCarriersByProcessId,
  },
}))

import {
  POST as normalizeAutoCarriersPost,
  runtime,
} from '~/routes/api/processes/[id]/normalize-auto-carriers'

describe('process normalize auto carriers route', () => {
  it('binds POST /api/processes/:id/normalize-auto-carriers to process controller', () => {
    expect(normalizeAutoCarriersPost).toBe(processHandlers.normalizeAutoCarriersByProcessId)
    expect(runtime).toBe('nodejs')
  })
})
