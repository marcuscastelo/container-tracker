import { describe, expect, it } from 'vitest'
import { collectVisibleSearchResultProcessIds } from '~/capabilities/search/ui/SearchOverlay.panel'

describe('collectVisibleSearchResultProcessIds', () => {
  it('collects only rows overlapping the scroll viewport', () => {
    const visibleRow = {
      dataset: {
        searchProcessId: 'process-visible',
      },
      getBoundingClientRect: () => ({
        top: 120,
        bottom: 160,
      }),
    }

    const hiddenRow = {
      dataset: {
        searchProcessId: 'process-hidden',
      },
      getBoundingClientRect: () => ({
        top: 320,
        bottom: 360,
      }),
    }

    const container = {
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 300,
      }),
      querySelectorAll: () => [visibleRow, hiddenRow],
    }

    expect(collectVisibleSearchResultProcessIds(container)).toEqual(['process-visible'])
  })
})
