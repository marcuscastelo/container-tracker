import { MOTION_DURATIONS_MS, type MotionDurationToken } from '~/shared/ui/motion/motion.tokens'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function toMotionDurationMs(duration: MotionDurationToken): number {
  if (prefersReducedMotion()) {
    return 0
  }

  return MOTION_DURATIONS_MS[duration]
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
