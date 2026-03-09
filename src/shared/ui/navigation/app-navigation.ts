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

type PrefetchDashboardIntentCommand = {
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: () => Promise<unknown> | unknown
  readonly nowMs?: number
}

const PROCESS_INTENT_THROTTLE_MS = 120
const DASHBOARD_INTENT_THROTTLE_MS = 120
const processIntentAtById = new Map<string, number>()
let lastDashboardIntentAtMs: number | null = null

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

  // Bound the intent map to avoid unbounded growth in long-lived sessions.
  // If the map grows beyond the configured max, evict the oldest entries by
  // timestamp so recent intents are kept.
  const PROCESS_INTENT_MAX_ENTRIES = 500
  if (processIntentAtById.size <= PROCESS_INTENT_MAX_ENTRIES) return

  const entries = Array.from(processIntentAtById.entries())
  entries.sort((a, b) => a[1] - b[1])
  let idx = 0
  while (processIntentAtById.size > PROCESS_INTENT_MAX_ENTRIES && idx < entries.length) {
    const keyToDelete = entries[idx][0]
    processIntentAtById.delete(keyToDelete)
    idx++
  }
}

export function buildProcessHref(processId: string): string {
  return `/shipments/${encodeURIComponent(processId)}`
}

export function buildDashboardHref(): string {
  return '/'
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

function shouldThrottleDashboardIntent(nowMs: number): boolean {
  if (lastDashboardIntentAtMs === null) return false
  return nowMs - lastDashboardIntentAtMs < DASHBOARD_INTENT_THROTTLE_MS
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

export function prefetchDashboardIntent(command: PrefetchDashboardIntentCommand): void {
  const nowMs = command.nowMs ?? Date.now()
  if (shouldThrottleDashboardIntent(nowMs)) return

  lastDashboardIntentAtMs = nowMs
  const href = buildDashboardHref()
  command.preloadRoute(href, { preloadData: true })

  if (command.preloadData) {
    void command.preloadData()
  }
}
