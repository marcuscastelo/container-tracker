import { describe, expect, it, vi } from 'vitest'

const searchHandlers = vi.hoisted(() => ({
  suggestions: vi.fn(),
}))

vi.mock('~/shared/api/search.controllers.bootstrap', () => ({
  searchControllers: {
    suggestions: searchHandlers.suggestions,
  },
}))

import { GET as suggestionsGet } from '~/routes/api/search/suggestions'

describe('search suggestions route', () => {
  it('binds GET /api/search/suggestions to search suggestions controller', () => {
    expect(suggestionsGet).toBe(searchHandlers.suggestions)
  })
})
