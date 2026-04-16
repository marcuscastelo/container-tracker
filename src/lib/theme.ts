import { createSignal } from 'solid-js'

export type UiTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'
const THEME_TRANSITION_CLASS = 'theme-transitioning'
const THEME_TRANSITION_DURATION_CSS_VAR = '--theme-transition-duration-ms'
const THEME_TRANSITION_DURATION_FALLBACK_MS = 220

const DEFAULT_THEME: UiTheme = 'light'

// TODO: Remove signal from lib/theme, and instead use a proper solidjs folder / file dedicated to theme reactivity
const [themeChangeCounter, setThemeChangeCounter] = createSignal(0)
let themeTransitionTimeoutId: number | null = null

function isUiTheme(value: string | null): value is UiTheme {
  return value === 'light' || value === 'dark'
}

function readStoredTheme(): UiTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isUiTheme(stored)) {
      return stored
    }
  } catch {
    // Ignore storage unavailability and keep safe default.
  }

  return DEFAULT_THEME
}

function persistTheme(theme: UiTheme): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore persistence failures (private mode, quota, etc.).
  }
}

function clearThemeTransitionTimeout(): void {
  if (themeTransitionTimeoutId === null || typeof window === 'undefined') {
    return
  }

  window.clearTimeout(themeTransitionTimeoutId)
  themeTransitionTimeoutId = null
}

function enableThemeTransitionClass(): void {
  if (typeof document === 'undefined') {
    return
  }

  clearThemeTransitionTimeout()
  document.documentElement.classList.add(THEME_TRANSITION_CLASS)
}

function disableThemeTransitionClass(): void {
  if (typeof document === 'undefined') {
    return
  }

  clearThemeTransitionTimeout()
  document.documentElement.classList.remove(THEME_TRANSITION_CLASS)
}

function readThemeTransitionDurationMs(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return THEME_TRANSITION_DURATION_FALLBACK_MS
  }

  if (typeof window.getComputedStyle !== 'function') {
    return THEME_TRANSITION_DURATION_FALLBACK_MS
  }

  const rawValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(THEME_TRANSITION_DURATION_CSS_VAR)
    .trim()

  const parsedValue = Number.parseFloat(rawValue)
  return Number.isFinite(parsedValue) ? parsedValue : THEME_TRANSITION_DURATION_FALLBACK_MS
}

function scheduleThemeTransitionCleanup(): void {
  if (typeof window === 'undefined') {
    return
  }

  clearThemeTransitionTimeout()
  themeTransitionTimeoutId = window.setTimeout(() => {
    disableThemeTransitionClass()
  }, readThemeTransitionDurationMs())
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function applyTheme(theme: UiTheme): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

function commitTheme(theme: UiTheme): void {
  applyTheme(theme)
  persistTheme(theme)
  setThemeChangeCounter((count) => count + 1)
}

export function getTheme(): UiTheme {
  void themeChangeCounter() // subscribe to changes so we get the latest theme if it was changed in another tab/window
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }

  return readStoredTheme()
}

function setTheme(theme: UiTheme): UiTheme {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    disableThemeTransitionClass()
    commitTheme(theme)
    return theme
  }

  enableThemeTransitionClass()
  commitTheme(theme)
  scheduleThemeTransitionCleanup()
  return theme
}

export function toggleTheme(): UiTheme {
  const nextTheme: UiTheme = getTheme() === 'dark' ? 'light' : 'dark'
  return setTheme(nextTheme)
}

export function initializeTheme(): UiTheme {
  const theme = readStoredTheme()
  applyTheme(theme)
  return theme
}
