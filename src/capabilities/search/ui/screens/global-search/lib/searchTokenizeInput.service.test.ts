import { describe, expect, it } from 'vitest'
import {
  formatSearchComposerChip,
  tryParseDraftFilterToken,
} from '~/capabilities/search/ui/screens/global-search/lib/searchTokenizeInput.service'

describe('searchTokenizeInput.service', () => {
  it('parses supported aliases and trims the value without accepting empty tokens', () => {
    expect(tryParseDraftFilterToken(' bl : MEDU1234567 ')).toEqual({
      key: 'bl',
      value: 'MEDU1234567',
    })
    expect(tryParseDraftFilterToken('importer:')).toBeNull()
    expect(tryParseDraftFilterToken(':value')).toBeNull()
  })

  it('does not convert unsupported or date-only filter tokens into composer chips', () => {
    expect(tryParseDraftFilterToken('event_date:2026-04-10')).toBeNull()
    expect(tryParseDraftFilterToken('unknown:abc')).toBeNull()
  })

  it('serializes accepted chips using the API filter contract', () => {
    expect(
      formatSearchComposerChip({
        key: 'container',
        value: 'MSCU1234567',
      }),
    ).toBe('container:MSCU1234567')
  })
})
