type NavigateOptions = {
  readonly replace?: boolean
  readonly scroll?: boolean
  readonly state?: unknown
}

type NavigateFn = (to: string, options?: NavigateOptions) => unknown
type PreloadRouteFn = (url: string | URL, options?: { readonly preloadData?: boolean }) => void

type NavigateToAppHrefCommand = {
  readonly navigate: NavigateFn
  readonly href: string
  readonly replace?: boolean
}

type NavigateToProcessCommand = {
  readonly navigate: NavigateFn
  readonly processId: string
  readonly replace?: boolean
}

type PrefetchProcessIntentCommand = {
  readonly processId: string
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: () => Promise<unknown> | unknown
  readonly nowMs?: number
}

const PROCESS_INTENT_THROTTLE_MS = 120
const processIntentAtById = new Map<string, number>()

function normalizeInternalHref(href: string): string | null {
  const trimmed = href.trim()
  if (trimmed.length === 0) return null
  if (!trimmed.startsWith('/')) return null
  return trimmed
}

function shouldThrottleProcessIntent(processId: string, nowMs: number): boolean {
  const lastIntentAt = processIntentAtById.get(processId)
  if (lastIntentAt === undefined) return false
  return nowMs - lastIntentAt < PROCESS_INTENT_THROTTLE_MS
}

function rememberProcessIntent(processId: string, nowMs: number): void {
  processIntentAtById.set(processId, nowMs)

  if (processIntentAtById.size <= 500) return

  for (const [cachedProcessId, cachedAt] of processIntentAtById.entries()) {
    if (nowMs - cachedAt > 30_000) {
      processIntentAtById.delete(cachedProcessId)
    }
  }
}

export function buildProcessHref(processId: string): string {
  return `/shipments/${encodeURIComponent(processId)}`
}

export function isInternalAppHref(href: string): boolean {
  return normalizeInternalHref(href) !== null
}

export function toInternalAppPathname(href: string): string | null {
  const internalHref = normalizeInternalHref(href)
  if (internalHref === null) return null
  return internalHref.split(/[?#]/, 1)[0] ?? null
}

export function navigateToAppHref(command: NavigateToAppHrefCommand): boolean {
  const internalHref = normalizeInternalHref(command.href)
  if (internalHref === null) return false

  void command.navigate(internalHref, { replace: command.replace })
  return true
}

export function navigateToProcess(command: NavigateToProcessCommand): void {
  void command.navigate(buildProcessHref(command.processId), { replace: command.replace })
}

export function prefetchProcessIntent(command: PrefetchProcessIntentCommand): void {
  const nowMs = command.nowMs ?? Date.now()
  if (shouldThrottleProcessIntent(command.processId, nowMs)) return

  rememberProcessIntent(command.processId, nowMs)
  const href = buildProcessHref(command.processId)
  command.preloadRoute(href, { preloadData: true })

  if (command.preloadData) {
    void command.preloadData()
  }
}
