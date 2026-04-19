export type BreakpointName = 'mobile' | 'tablet' | 'desktop'

export type BreakpointRange = {
  readonly min?: number
  readonly max?: number
}

export type Breakpoints = {
  readonly mobile: BreakpointRange
  readonly tablet: BreakpointRange
  readonly desktop: BreakpointRange
}

export const DEFAULT_BREAKPOINTS: Breakpoints = {
  mobile: { max: 639 },
  tablet: { min: 640, max: 1023 },
  desktop: { min: 1024 },
}

export function mergeBreakpoints(overrides?: Partial<Breakpoints>): Breakpoints {
  if (overrides === undefined) {
    return DEFAULT_BREAKPOINTS
  }

  return {
    mobile: { ...DEFAULT_BREAKPOINTS.mobile, ...overrides.mobile },
    tablet: { ...DEFAULT_BREAKPOINTS.tablet, ...overrides.tablet },
    desktop: { ...DEFAULT_BREAKPOINTS.desktop, ...overrides.desktop },
  }
}

export function toMediaQuery(range: BreakpointRange): string {
  const parts: string[] = []

  if (range.min !== undefined) {
    parts.push(`(min-width: ${range.min}px)`)
  }

  if (range.max !== undefined) {
    parts.push(`(max-width: ${range.max}px)`)
  }

  if (parts.length === 0) {
    return '(min-width: 0px)'
  }

  return parts.join(' and ')
}
