import { createSignal, onCleanup, onMount } from 'solid-js'
import {
  mergeBreakpoints,
  toMediaQuery,
  type BreakpointName,
  type Breakpoints,
} from '~/shared/ui/responsive/responsive-breakpoints'

type UseResponsiveBreakpointsOptions = {
  readonly breakpoints?: Partial<Breakpoints>
}

type UseResponsiveBreakpointsResult = {
  readonly breakpoint: () => BreakpointName
  readonly isMobile: () => boolean
  readonly isTablet: () => boolean
  readonly isDesktop: () => boolean
  readonly breakpoints: Breakpoints
}

type NamedMediaQuery = {
  readonly name: BreakpointName
  readonly mediaQueryList: MediaQueryList
}

const FALLBACK_BREAKPOINT: BreakpointName = 'mobile'
const BREAKPOINT_ORDER: readonly BreakpointName[] = ['mobile', 'tablet', 'desktop']

function createMediaQueries(config: Breakpoints): readonly NamedMediaQuery[] {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return []
  }

  return BREAKPOINT_ORDER.map((name) => ({
    name,
    mediaQueryList: window.matchMedia(toMediaQuery(config[name])),
  }))
}

function evaluateBreakpointFromMediaQueries(
  mediaQueries: readonly NamedMediaQuery[],
): BreakpointName {
  for (const entry of mediaQueries) {
    if (entry.mediaQueryList.matches) {
      return entry.name
    }
  }

  return mediaQueries[0]?.name ?? FALLBACK_BREAKPOINT
}

function resolveInitialBreakpoint(config: Breakpoints): BreakpointName {
  const mediaQueries = createMediaQueries(config)

  if (mediaQueries.length === 0) {
    return FALLBACK_BREAKPOINT
  }

  return evaluateBreakpointFromMediaQueries(mediaQueries)
}

export function useResponsiveBreakpoints(
  options?: UseResponsiveBreakpointsOptions,
): UseResponsiveBreakpointsResult {
  const resolvedBreakpoints = mergeBreakpoints(options?.breakpoints)
  const [currentBreakpoint, setCurrentBreakpoint] = createSignal<BreakpointName>(
    resolveInitialBreakpoint(resolvedBreakpoints),
  )

  onMount(() => {
    const mediaQueries = createMediaQueries(resolvedBreakpoints)

    if (mediaQueries.length === 0) {
      return
    }

    const updateBreakpoint = (): void => {
      setCurrentBreakpoint(evaluateBreakpointFromMediaQueries(mediaQueries))
    }

    updateBreakpoint()

    for (const entry of mediaQueries) {
      entry.mediaQueryList.addEventListener('change', updateBreakpoint)
    }

    onCleanup(() => {
      for (const entry of mediaQueries) {
        entry.mediaQueryList.removeEventListener('change', updateBreakpoint)
      }
    })
  })

  return {
    breakpoint: currentBreakpoint,
    isMobile: () => currentBreakpoint() === 'mobile',
    isTablet: () => currentBreakpoint() === 'tablet',
    isDesktop: () => currentBreakpoint() === 'desktop',
    breakpoints: resolvedBreakpoints,
  }
}
