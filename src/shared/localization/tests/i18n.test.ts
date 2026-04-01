import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { createTranslationApi, useTranslation } from '~/shared/localization/i18n'

describe('shared localization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('translates keys with interpolation', () => {
    const { t, keys } = createTranslationApi({ devMode: true })

    expect(t(keys.header.alertsBadge, { count: 3 })).toBe('3 Alertas')
  })

  it('memoizes nested key proxies', () => {
    const { keys } = createTranslationApi({ devMode: true })

    expect(keys.header).toBe(keys.header)
    expect(keys.header.theme).toBe(keys.header.theme)
  })

  it('returns a visible fallback and warns once in dev mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { t } = createTranslationApi({ devMode: true })
    const missingDevKey = 'missing.dev.example'

    expect(t(missingDevKey)).toBe('[missing] missing.dev.example')
    expect(t(missingDevKey)).toBe('[missing] missing.dev.example')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('returns the raw key without warning in prod mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { t } = createTranslationApi({ devMode: false })
    const missingProdKey = 'missing.prod.example'

    expect(t(missingProdKey)).toBe('missing.prod.example')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('keeps locale pinned to DEFAULT_LOCALE', () => {
    expect(useTranslation().locale()).toBe(DEFAULT_LOCALE)
  })
})
