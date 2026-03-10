import { describe, expect, it } from 'vitest'
import {
  MAX_CONTAINERS_PER_PASTE,
  mergeBulkPastedContainers,
  parseContainerBulkPaste,
} from '~/modules/process/ui/validation/containerBulkPaste.validation'

describe('containerBulkPaste.validation', () => {
  describe('parseContainerBulkPaste', () => {
    it('returns multiple values for newline, comma, semicolon, tab and space delimiters', () => {
      const result = parseContainerBulkPaste('MRKU2733926,\nMNBU3094033;\tMSKU0804154 FFAU6714380')

      expect(result).toEqual({
        type: 'multiple',
        values: ['MRKU2733926', 'MNBU3094033', 'MSKU0804154', 'FFAU6714380'],
      })
    })

    it('normalizes markdown bullets, quotes, json wrappers and deduplicates values', () => {
      const result = parseContainerBulkPaste(`- "mrku2733926"
- "MNBU3094033"
["msku0804154","MRKU2733926"]\u200B`)

      expect(result).toEqual({
        type: 'multiple',
        values: ['MRKU2733926', 'MNBU3094033', 'MSKU0804154'],
      })
    })

    it('returns single when only one container is found', () => {
      const result = parseContainerBulkPaste('  "mnbu3094033"  ')

      expect(result).toEqual({ type: 'single', value: 'MNBU3094033' })
    })

    it('treats duplicated multi-line paste as bulk and keeps one unique value', () => {
      const result = parseContainerBulkPaste('MRKU2733926\nmrku2733926')

      expect(result).toEqual({
        type: 'multiple',
        values: ['MRKU2733926'],
      })
    })

    it('returns none when input has no valid tokens', () => {
      const result = parseContainerBulkPaste('  \n\t , ; ')

      expect(result).toEqual({ type: 'none' })
    })

    it('returns limit-exceeded when pasted unique values exceed max', () => {
      const pasted = Array.from(
        { length: MAX_CONTAINERS_PER_PASTE + 1 },
        (_, index) => `MSCU${String(index).padStart(7, '0')}`,
      ).join('\n')

      const result = parseContainerBulkPaste(pasted)

      expect(result).toEqual({
        type: 'limit-exceeded',
        detectedCount: MAX_CONTAINERS_PER_PASTE + 1,
        maxAllowed: MAX_CONTAINERS_PER_PASTE,
      })
    })
  })

  describe('mergeBulkPastedContainers', () => {
    it('replaces target and inserts remaining pasted values after target', () => {
      const result = mergeBulkPastedContainers({
        existingContainerNumbers: ['', 'FFAU6714380'],
        targetIndex: 0,
        pastedValues: ['MRKU2733926', 'MNBU3094033'],
      })

      expect(result).toEqual({
        nextContainerNumbers: ['MRKU2733926', 'MNBU3094033', 'FFAU6714380'],
        appliedValues: ['MRKU2733926', 'MNBU3094033'],
      })
    })

    it('skips values already present in other rows and keeps insertion order', () => {
      const result = mergeBulkPastedContainers({
        existingContainerNumbers: ['', 'MNBU3094033', 'FFAU6714380'],
        targetIndex: 0,
        pastedValues: ['mnbu3094033', 'mrku2733926', 'MRKU2733926'],
      })

      expect(result).toEqual({
        nextContainerNumbers: ['MRKU2733926', 'MNBU3094033', 'FFAU6714380'],
        appliedValues: ['MRKU2733926'],
      })
    })

    it('returns unchanged when no new value can be applied', () => {
      const result = mergeBulkPastedContainers({
        existingContainerNumbers: ['', 'MNBU3094033'],
        targetIndex: 0,
        pastedValues: ['mnbu3094033', 'MNBU3094033'],
      })

      expect(result).toEqual({
        nextContainerNumbers: ['', 'MNBU3094033'],
        appliedValues: [],
      })
    })
  })
})
