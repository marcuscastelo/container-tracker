import { describe, expect, it } from 'vitest'
import { parseGlobalSearchQuery } from '~/capabilities/search/application/parse-global-search-query'

describe('parseGlobalSearchQuery', () => {
  it('merges draft text and repeated chip filters while preserving free-text terms', () => {
    const parsed = parseGlobalSearchQuery({
      query: 'flush status:delivered',
      filters: ['carrier:MSC', 'importer:Flush Logistics'],
    })

    expect(parsed.freeTextTerms.map((term) => term.rawValue)).toEqual(['flush'])
    expect(parsed.filters).toEqual([
      expect.objectContaining({
        key: 'carrier',
        rawValue: 'MSC',
        source: 'chip',
      }),
      expect.objectContaining({
        key: 'importer',
        rawValue: 'Flush Logistics',
        source: 'chip',
      }),
      expect.objectContaining({
        key: 'status',
        rawValue: 'delivered',
        source: 'draft',
      }),
    ])
  })

  it('keeps only the last duplicate filter and surfaces a warning', () => {
    const parsed = parseGlobalSearchQuery({
      query: 'status:in_transit',
      filters: ['status:DELIVERED', 'carrier:MSC'],
    })

    expect(parsed.filters).toEqual([
      expect.objectContaining({
        key: 'carrier',
        rawValue: 'MSC',
      }),
      expect.objectContaining({
        key: 'status',
        rawValue: 'in_transit',
      }),
    ])
    expect(parsed.warnings).toContain('Duplicate filter overridden by the last value: status')
  })

  it('treats unknown fields as free text and reserves event_date as unsupported', () => {
    const parsed = parseGlobalSearchQuery({
      query: 'foo:bar 06/05',
      filters: ['event_date:06/05/2026'],
    })

    expect(parsed.freeTextTerms.map((term) => term.rawValue)).toEqual(['foo:bar', '06/05'])
    expect(parsed.filters).toEqual([
      expect.objectContaining({
        key: 'event_date',
        supported: false,
      }),
    ])
    expect(parsed.warnings).toContain('Unsupported filter reserved for future use: event_date')
  })
})
