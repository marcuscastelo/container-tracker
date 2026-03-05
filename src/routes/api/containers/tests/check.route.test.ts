import { describe, expect, it, vi } from 'vitest'

const containerHandlers = vi.hoisted(() => ({
  checkContainers: vi.fn(),
}))

vi.mock('~/modules/container/interface/http/container.controllers.bootstrap', () => ({
  bootstrapContainerControllers: () => ({
    checkContainers: containerHandlers.checkContainers,
  }),
}))

import { POST as checkContainersPost } from '~/routes/api/containers/check'

describe('container check route', () => {
  it('binds POST /api/containers/check to container controller', () => {
    expect(checkContainersPost).toBe(containerHandlers.checkContainers)
  })
})
