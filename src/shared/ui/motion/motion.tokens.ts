export const MOTION_DURATIONS_MS = {
  fast: 90,
  base: 140,
  slow: 180,
  panel: 220,
  highlight: 1200,
} as const

export type MotionDurationToken = keyof typeof MOTION_DURATIONS_MS

export const MOTION_EASINGS = {
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  press: 'cubic-bezier(0.2, 0, 0, 1)',
} as const

export const MOTION_TRANSFORMS = {
  liftY: '-1px',
  slideYSm: '4px',
  scalePress: '0.985',
  scaleEnterFrom: '0.985',
} as const
