import { describe, expect, it, vi } from 'vitest'

const processHandlers = vi.hoisted(() => ({
  getProcessById: vi.fn(),
  updateProcessById: vi.fn(),
  deleteProcessById: vi.fn(),
}))

vi.mock('~/modules/process/interface/http/process.controllers.bootstrap', () => ({
  processControllers: {
    getProcessById: processHandlers.getProcessById,
    updateProcessById: processHandlers.updateProcessById,
    deleteProcessById: processHandlers.deleteProcessById,
  },
}))

import {
  DELETE as processDeleteById,
  GET as processGetById,
  PATCH as processPatchById,
} from '~/routes/api/processes/[id]/index'

describe('process by id route', () => {
  it('binds GET/PATCH/DELETE /api/processes/:id to process controllers', () => {
    expect(processGetById).toBe(processHandlers.getProcessById)
    expect(processPatchById).toBe(processHandlers.updateProcessById)
    expect(processDeleteById).toBe(processHandlers.deleteProcessById)
  })
})
