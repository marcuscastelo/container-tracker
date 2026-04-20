import { afterEach, describe, expect, it, vi } from 'vitest'

function createThemeClassList() {
  const classes = new Set<string>()

  return {
    add: vi.fn((value: string) => {
      classes.add(value)
    }),
    remove: vi.fn((value: string) => {
      classes.delete(value)
    }),
    toggle: vi.fn((value: string, force?: boolean) => {
      if (force === undefined) {
        if (classes.has(value)) {
          classes.delete(value)
        } else {
          classes.add(value)
        }
      } else if (force) {
        classes.add(value)
      } else {
        classes.delete(value)
      }

      return classes.has(value)
    }),
    contains: vi.fn((value: string) => classes.has(value)),
  }
}

function installThemeGlobals(themeTransitionDuration: string): {
  readonly documentElement: {
    readonly classList: ReturnType<typeof createThemeClassList>
    readonly style: { colorScheme?: string }
  }
  readonly setTimeoutSpy: ReturnType<typeof vi.fn>
  readonly getComputedStyleSpy: ReturnType<typeof vi.fn>
} {
  const documentElement = {
    classList: createThemeClassList(),
    style: {},
  }

  const setTimeoutSpy = vi.fn(() => 1)
  const clearTimeoutSpy = vi.fn()
  const getComputedStyleSpy = vi.fn(() => ({
    getPropertyValue: (name: string) =>
      name === '--theme-transition-duration-ms' ? themeTransitionDuration : '',
  }))
  const matchMediaSpy = vi.fn(() => ({ matches: false }))

  vi.stubGlobal('document', {
    documentElement,
  })
  vi.stubGlobal('window', {
    clearTimeout: clearTimeoutSpy,
    getComputedStyle: getComputedStyleSpy,
    localStorage: globalThis.localStorage,
    matchMedia: matchMediaSpy,
    setTimeout: setTimeoutSpy,
  })

  return {
    documentElement,
    setTimeoutSpy,
    getComputedStyleSpy,
  }
}

describe('theme transitions', () => {
  afterEach(() => {
    globalThis.localStorage.clear()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('schedules cleanup using the shared CSS transition duration token', async () => {
    const runtime = installThemeGlobals('187ms')
    const { toggleTheme } = await import('~/lib/theme')

    expect(toggleTheme()).toBe('dark')
    expect(runtime.getComputedStyleSpy).toHaveBeenCalledWith(runtime.documentElement)
    expect(runtime.setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 187)
  })

  it('falls back to the default duration when the CSS token is missing', async () => {
    const runtime = installThemeGlobals('')
    const { toggleTheme } = await import('~/lib/theme')

    expect(toggleTheme()).toBe('dark')
    expect(runtime.setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 220)
  })
})
