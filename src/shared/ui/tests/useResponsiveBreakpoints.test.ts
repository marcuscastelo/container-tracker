import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResponsiveBreakpoints } from '~/shared/ui/hooks/useResponsiveBreakpoints'
import {
  DEFAULT_BREAKPOINTS,
  toMediaQuery,
  type Breakpoints,
} from '~/shared/ui/responsive/responsive-breakpoints'

type MediaQueryListener = (event: MediaQueryListEvent) => void

class MediaQueryListController implements MediaQueryList {
  matches: boolean
  media: string
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null
  readonly listeners = new Set<MediaQueryListener>()
  readonly dispatchEvent = (_event: Event): boolean => true

  constructor(media: string, initialMatch: boolean) {
    this.media = media
    this.matches = initialMatch
  }

  addEventListener(_type: 'change', listener: MediaQueryListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'change', listener: MediaQueryListener): void {
    this.listeners.delete(listener)
  }

  addListener(listener: MediaQueryListener): void {
    this.listeners.add(listener)
  }

  removeListener(listener: MediaQueryListener): void {
    this.listeners.delete(listener)
  }

  setMatches(match: boolean): void {
    if (this.matches === match) {
      return
    }

    this.matches = match
    const event = this.buildEvent(match)

    for (const listener of this.listeners) {
      listener.call(this, event)
    }

    if (this.onchange !== null) {
      this.onchange.call(this, event)
    }
  }

  private buildEvent(match: boolean): MediaQueryListEvent {
    return {
      matches: match,
      media: this.media,
      type: 'change',
      target: null,
      currentTarget: null,
      eventPhase: Event.NONE,
      bubbles: false,
      cancelable: false,
      defaultPrevented: false,
      composed: false,
      isTrusted: false,
      timeStamp: 0,
      srcElement: null,
      returnValue: true,
      cancelBubble: false,
      composedPath: () => [],
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
      stopPropagation: () => {},
      initEvent: () => {},
      AT_TARGET: Event.AT_TARGET,
      CAPTURING_PHASE: Event.CAPTURING_PHASE,
      BUBBLING_PHASE: Event.BUBBLING_PHASE,
      NONE: Event.NONE,
    }
  }
}

class MatchMediaController {
  private readonly registry = new Map<string, MediaQueryListController>()

  constructor(initialMatches: Record<string, boolean>) {
    for (const [query, match] of Object.entries(initialMatches)) {
      this.registry.set(query, new MediaQueryListController(query, match))
    }
  }

  matchMedia = (query: string): MediaQueryListController => {
    const existing = this.registry.get(query)

    if (existing !== undefined) {
      return existing
    }

    const created = new MediaQueryListController(query, false)
    this.registry.set(query, created)
    return created
  }

  setMatch(query: string, matches: boolean): void {
    this.matchMedia(query).setMatches(matches)
  }

  listenerCount(query: string): number {
    return this.matchMedia(query).listeners.size
  }
}

type HookHarness = ReturnType<typeof useResponsiveBreakpoints> & { readonly dispose: () => void }

function mountHook(options?: { readonly breakpoints?: Partial<Breakpoints> }): HookHarness {
  return createRoot((dispose) => ({
    ...useResponsiveBreakpoints(options),
    dispose,
  }))
}

describe('useResponsiveBreakpoints', () => {
  let originalWindow: typeof globalThis.window | undefined

  beforeEach(() => {
    originalWindow = globalThis.window
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
      return
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('uses default breakpoints and returns the matching breakpoint', () => {
    const matchMediaController = new MatchMediaController({
      [toMediaQuery(DEFAULT_BREAKPOINTS.mobile)]: false,
      [toMediaQuery(DEFAULT_BREAKPOINTS.tablet)]: true,
      [toMediaQuery(DEFAULT_BREAKPOINTS.desktop)]: false,
    })

    vi.stubGlobal('window', {
      matchMedia: matchMediaController.matchMedia,
    })

    const hook = mountHook()

    expect(hook.breakpoint()).toBe('tablet')
    expect(hook.isTablet()).toBe(true)
    hook.dispose()
  })

  it('supports overriding breakpoint ranges and uses the provided queries', () => {
    const customBreakpoints: Breakpoints = {
      mobile: { max: 479 },
      tablet: { min: 480, max: 991 },
      desktop: { min: 992 },
    }
    const queries: string[] = []
    const matchMediaController = new MatchMediaController({
      [toMediaQuery(customBreakpoints.mobile)]: false,
      [toMediaQuery(customBreakpoints.tablet)]: false,
      [toMediaQuery(customBreakpoints.desktop)]: true,
    })

    vi.stubGlobal('window', {
      matchMedia: (query: string) => {
        queries.push(query)
        return matchMediaController.matchMedia(query)
      },
    })

    const hook = mountHook({ breakpoints: customBreakpoints })

    expect(queries).toEqual([
      toMediaQuery(customBreakpoints.mobile),
      toMediaQuery(customBreakpoints.tablet),
      toMediaQuery(customBreakpoints.desktop),
    ])
    expect(hook.isDesktop()).toBe(true)
    hook.dispose()
  })

  it('reacts to breakpoint changes and cleans up listeners on dispose', () => {
    const matchMediaController = new MatchMediaController({
      [toMediaQuery(DEFAULT_BREAKPOINTS.mobile)]: true,
      [toMediaQuery(DEFAULT_BREAKPOINTS.tablet)]: false,
      [toMediaQuery(DEFAULT_BREAKPOINTS.desktop)]: false,
    })

    vi.stubGlobal('window', {
      matchMedia: matchMediaController.matchMedia,
    })

    const hook = mountHook()

    expect(hook.isMobile()).toBe(true)

    matchMediaController.setMatch(toMediaQuery(DEFAULT_BREAKPOINTS.mobile), false)
    matchMediaController.setMatch(toMediaQuery(DEFAULT_BREAKPOINTS.tablet), true)

    expect(hook.isTablet()).toBe(true)
    hook.dispose()

    expect(
      matchMediaController.listenerCount(toMediaQuery(DEFAULT_BREAKPOINTS.mobile)),
    ).toBe(0)
    expect(
      matchMediaController.listenerCount(toMediaQuery(DEFAULT_BREAKPOINTS.tablet)),
    ).toBe(0)
    expect(
      matchMediaController.listenerCount(toMediaQuery(DEFAULT_BREAKPOINTS.desktop)),
    ).toBe(0)
  })

  it('is SSR-safe and falls back to mobile when window is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'window')
    const hook = mountHook()

    expect(hook.breakpoint()).toBe('mobile')
    hook.dispose()
  })
})
