import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import {
  resolveFallbackLanguage,
  resolveInitialLanguage,
} from '~/shared/localization/languageSelection'

describe('resolveInitialLanguage', () => {
  it('keeps stored locale precedence when it is available', () => {
    expect(resolveInitialLanguage(['en-US', 'pt-BR'], 'en-US', 'pt-BR')).toBe('en-US')
  })

  it('defaults to pt-BR for new browsers when no locale is persisted', () => {
    expect(resolveInitialLanguage(['en-US', 'pt-BR', 'pt-PT'], null, 'en-US')).toBe(DEFAULT_LOCALE)
  })

  it('uses current language when default locale is unavailable', () => {
    expect(resolveInitialLanguage(['en-US', 'pt-PT'], null, 'pt-PT')).toBe('pt-PT')
  })

  it('falls back to first available locale when needed', () => {
    expect(resolveInitialLanguage(['en-US', 'pt-PT'], null, 'fr-FR')).toBe('en-US')
  })
})

describe('resolveFallbackLanguage', () => {
  it('uses default locale when available', () => {
    expect(resolveFallbackLanguage(['en-US', 'pt-BR', 'pt-PT'])).toBe(DEFAULT_LOCALE)
  })

  it('falls back to first available locale when default is unavailable', () => {
    expect(resolveFallbackLanguage(['en-US', 'pt-PT'])).toBe('en-US')
  })
})
