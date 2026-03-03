import { describe, expect, it, vi } from 'vitest'

const searchHandlers = vi.hoisted(() => ({
  search: vi.fn(),
}))

vi.mock('~/capabilities/search/interface/http/search.controllers.bootstrap', () => ({
  searchControllers: {
    search: searchHandlers.search,
  },
}))

import { GET as searchGet } from '~/routes/api/search'

describe('search route', () => {
  it('binds GET /api/search to search controller', () => {
    expect(searchGet).toBe(searchHandlers.search)
  })
})
