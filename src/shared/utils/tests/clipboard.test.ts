import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '~/shared/utils/clipboard'

describe('copyToClipboard util', () => {
  afterEach(() => {
    try {
      vi.unstubAllGlobals()
    } catch {
      // ignore
    }
  })

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    // stub global navigator
    vi.stubGlobal('navigator', { clipboard: { writeText } } as any)

    await expect(copyToClipboard('abc')).resolves.toBeUndefined()
    expect(writeText).toHaveBeenCalledWith('abc')
  })

  it('falls back gracefully when clipboard API is not available', async () => {
    // stub navigator without clipboard
    vi.stubGlobal('navigator', {} as any)

    // call should not throw even if execCommand is not supported
    await expect(copyToClipboard('fallback-test')).resolves.toBeUndefined()
  })
})
