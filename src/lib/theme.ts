export type UiTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

const DEFAULT_THEME: UiTheme = 'light'

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

export function applyTheme(theme: UiTheme): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function getTheme(): UiTheme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }

  return readStoredTheme()
}

export function setTheme(theme: UiTheme): UiTheme {
  applyTheme(theme)
  persistTheme(theme)
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
