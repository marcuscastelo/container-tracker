import {
  MOTION_DURATION_CSS_VARS,
  MOTION_DURATIONS_MS,
  type MotionDurationToken,
} from '~/shared/ui/motion/motion.tokens'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function toMotionDurationCssValue(duration: MotionDurationToken): string {
  return `var(${MOTION_DURATION_CSS_VARS[duration]})`
}

export function readMotionDurationMs(duration: MotionDurationToken): number {
  const fallbackMs = MOTION_DURATIONS_MS[duration]

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof window.getComputedStyle !== 'function'
  ) {
    return fallbackMs
  }

  const rawValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(MOTION_DURATION_CSS_VARS[duration])
    .trim()

  const parsedValue = Number.parseFloat(rawValue)
  return Number.isFinite(parsedValue) ? parsedValue : fallbackMs
}

export function toMotionDurationMs(duration: MotionDurationToken): number {
  if (prefersReducedMotion()) {
    return 0
  }

  return readMotionDurationMs(duration)
}

export function scheduleMotionTimeout(
  callback: () => void,
  duration: MotionDurationToken,
  extraDelayMs = 0,
): number | null {
  if (typeof window === 'undefined') {
    callback()
    return null
  }

  const delayMs = toMotionDurationMs(duration) + extraDelayMs
  if (delayMs <= 0) {
    callback()
    return null
  }

  return window.setTimeout(callback, delayMs)
}

export function clearMotionTimeout(timeoutId: number | null): void {
  if (timeoutId === null || typeof window === 'undefined') {
    return
  }

  window.clearTimeout(timeoutId)
}

export function scheduleMotionFrame(callback: () => void): void {
  if (typeof window === 'undefined') {
    callback()
    return
  }

  window.requestAnimationFrame(() => {
    callback()
  })
}
