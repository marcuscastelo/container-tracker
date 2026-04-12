import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMotionCollapseTransition } from '~/shared/ui/motion/MotionCollapse'
import { MOTION_DURATIONS_MS } from '~/shared/ui/motion/motion.tokens'
import {
  readMotionDurationMs,
  toMotionDurationCssValue,
  toMotionDurationMs,
} from '~/shared/ui/motion/motion.utils'

function installMotionGlobals(options?: {
  readonly durationValue?: string
  readonly reducedMotion?: boolean
}) {
  const documentElement = {}
  const getComputedStyleSpy = vi.fn(() => ({
    getPropertyValue: (name: string) => {
      return name === '--motion-duration-panel' ? (options?.durationValue ?? '') : ''
    },
  }))
  const matchMediaSpy = vi.fn(() => ({
    matches: options?.reducedMotion ?? false,
  }))

  vi.stubGlobal('document', {
    documentElement,
  })
  vi.stubGlobal('window', {
    getComputedStyle: getComputedStyleSpy,
    matchMedia: matchMediaSpy,
  })

  return {
    documentElement,
    getComputedStyleSpy,
  }
}

describe('motion duration utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads runtime duration from motion CSS variables', () => {
    const runtime = installMotionGlobals({ durationValue: '275ms' })

    expect(readMotionDurationMs('panel')).toBe(275)
    expect(runtime.getComputedStyleSpy).toHaveBeenCalledWith(runtime.documentElement)
  })

  it('falls back to token defaults when CSS duration variable is missing', () => {
    installMotionGlobals()

    expect(readMotionDurationMs('panel')).toBe(MOTION_DURATIONS_MS.panel)
  })

  it('returns zero duration when reduced motion is preferred', () => {
    installMotionGlobals({
      durationValue: '275ms',
      reducedMotion: true,
    })

    expect(toMotionDurationMs('panel')).toBe(0)
  })

  it('builds collapse transitions from requested duration token', () => {
    expect(toMotionDurationCssValue('fast')).toBe('var(--motion-duration-fast)')
    expect(buildMotionCollapseTransition('fast', 'enter')).toBe(
      'height var(--motion-duration-fast) var(--motion-ease-enter), opacity var(--motion-duration-fast) var(--motion-ease-enter)',
    )
  })
})
