export function getAppErrorDetails(error: unknown, isDev: boolean): string | null {
  if (!isDev) return null

  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  return String(error)
}
