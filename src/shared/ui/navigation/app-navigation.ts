import {
  createViewportPrefetchController,
  flushScheduledNavigationPrefetches,
  type PrefetchPriority,
  scheduleNavigationPrefetch,
} from '~/shared/ui/navigation/prefetch.scheduler'

type NavigateOptions = {
  readonly replace?: boolean
  readonly scroll?: boolean
  readonly state?: unknown
}

type NavigateFn = (to: string, options?: NavigateOptions) => unknown
export type PreloadRouteFn = (
  url: string | URL,
  options?: { readonly preloadData?: boolean },
) => void

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

type NavigateToProcessContainerCommand = {
  readonly navigate: NavigateFn
  readonly processId: string
  readonly containerNumber: string
  readonly replace?: boolean
  readonly navigationState?: ProcessContainerNavigationState
  readonly state?: unknown
}

type PrefetchProcessIntentCommand = {
  readonly processId: string
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: () => Promise<unknown> | unknown
}

type PrefetchDashboardIntentCommand = {
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: () => Promise<unknown> | unknown
}

type ScheduleIntentPrefetchCommand = {
  readonly processId: string
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: (processId: string) => Promise<unknown> | unknown
}

type ScheduleVisiblePrefetchCommand = {
  readonly processIds: readonly string[]
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: (processId: string) => Promise<unknown> | unknown
}

type ScheduleDashboardPrefetchCommand = {
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: () => Promise<unknown> | unknown
  readonly priority: PrefetchPriority
}

const MAX_VISIBLE_PREFETCH_PER_FLUSH = 10

export type ProcessContainerNavigationState = {
  readonly source: 'navbar-alerts'
  readonly focusSection: 'current-status'
  readonly revealLiveStatus: true
  readonly requestKey: string
}

function normalizeInternalHref(href: string): string | null {
  const trimmed = href.trim()
  if (trimmed.length === 0) return null
  if (!trimmed.startsWith('/')) return null
  return trimmed
}

function toNavigateOptions(replace?: boolean): NavigateOptions | undefined {
  if (replace === undefined) return undefined
  return { replace }
}

function withNavigateState(
  options: NavigateOptions | undefined,
  state: unknown,
): NavigateOptions | undefined {
  if (options === undefined) {
    return { state }
  }
  return {
    ...options,
    state,
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toProcessPrefetchKey(processId: string): string {
  return `process:${processId}`
}

function toDashboardPrefetchKey(): string {
  return 'dashboard'
}

function toVisibleProcessIds(processIds: readonly string[]): readonly string[] {
  const visibleProcessIds = new Set<string>()

  for (const processId of processIds) {
    const normalizedProcessId = processId.trim()
    if (normalizedProcessId.length === 0) continue

    visibleProcessIds.add(normalizedProcessId)
    if (visibleProcessIds.size >= MAX_VISIBLE_PREFETCH_PER_FLUSH) break
  }

  return [...visibleProcessIds]
}

function enqueueProcessPrefetch(command: {
  readonly processId: string
  readonly preloadRoute: PreloadRouteFn
  readonly preloadData?: (processId: string) => Promise<unknown> | unknown
  readonly priority: PrefetchPriority
}): void {
  const processId = command.processId.trim()
  if (processId.length === 0) return

  const href = buildProcessHref(processId)

  scheduleNavigationPrefetch({
    key: toProcessPrefetchKey(processId),
    priority: command.priority,
    run: () => {
      command.preloadRoute(href, { preloadData: true })
      return command.preloadData?.(processId)
    },
  })
}

export { createViewportPrefetchController, type PrefetchPriority }

export function buildProcessHref(processId: string): string {
  return `/shipments/${encodeURIComponent(processId)}`
}

export function buildProcessContainerHref(
  processId: string,
  containerNumber: string,
  navigationState?: ProcessContainerNavigationState,
): string {
  const processHref = buildProcessHref(processId)
  const normalizedContainerNumber = containerNumber.trim().toUpperCase()
  if (normalizedContainerNumber.length === 0) {
    return processHref
  }

  const searchParams = new URLSearchParams()
  searchParams.set('container', normalizedContainerNumber)

  if (navigationState !== undefined) {
    searchParams.set('focus', navigationState.focusSection)
    searchParams.set('focusRequest', navigationState.requestKey)
  }

  return `${processHref}?${searchParams.toString()}`
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

  void command.navigate(internalHref, toNavigateOptions(command.replace))
  return true
}

export function navigateToProcess(command: NavigateToProcessCommand): void {
  void command.navigate(buildProcessHref(command.processId), toNavigateOptions(command.replace))
}

export function navigateToProcessContainer(command: NavigateToProcessContainerCommand): void {
  const navigateOptions =
    command.state === undefined
      ? toNavigateOptions(command.replace)
      : withNavigateState(toNavigateOptions(command.replace), command.state)

  void command.navigate(
    buildProcessContainerHref(command.processId, command.containerNumber, command.navigationState),
    navigateOptions,
  )
}

export function readProcessContainerNavigationState(
  state: unknown,
): ProcessContainerNavigationState | null {
  if (typeof state !== 'object' || state === null) return null

  const source = Reflect.get(state, 'source')
  const focusSection = Reflect.get(state, 'focusSection')
  const revealLiveStatus = Reflect.get(state, 'revealLiveStatus')
  const requestKey = Reflect.get(state, 'requestKey')

  if (source !== 'navbar-alerts') return null
  if (focusSection !== 'current-status') return null
  if (revealLiveStatus !== true) return null
  if (!isNonBlankString(requestKey)) return null

  return {
    source,
    focusSection,
    revealLiveStatus,
    requestKey,
  }
}

export function readProcessContainerNavigationStateFromSearch(
  search: string,
): ProcessContainerNavigationState | null {
  const searchParams = new URLSearchParams(search)
  const focusSection = searchParams.get('focus')
  const requestKey = searchParams.get('focusRequest')

  if (focusSection !== 'current-status') return null
  if (!isNonBlankString(requestKey)) return null

  return {
    source: 'navbar-alerts',
    focusSection,
    revealLiveStatus: true,
    requestKey,
  }
}

export function scheduleIntentPrefetch(command: ScheduleIntentPrefetchCommand): void {
  enqueueProcessPrefetch({
    processId: command.processId,
    preloadRoute: command.preloadRoute,
    priority: 'intent',
    ...(command.preloadData ? { preloadData: command.preloadData } : {}),
  })
}

export function scheduleVisiblePrefetch(command: ScheduleVisiblePrefetchCommand): void {
  const visibleProcessIds = toVisibleProcessIds(command.processIds)
  if (visibleProcessIds.length === 0) return

  for (const processId of visibleProcessIds) {
    enqueueProcessPrefetch({
      processId,
      preloadRoute: command.preloadRoute,
      priority: 'viewport',
      ...(command.preloadData ? { preloadData: command.preloadData } : {}),
    })
  }

  flushScheduledNavigationPrefetches()
}

export function scheduleDashboardPrefetch(command: ScheduleDashboardPrefetchCommand): void {
  const href = buildDashboardHref()

  scheduleNavigationPrefetch({
    key: toDashboardPrefetchKey(),
    priority: command.priority,
    run: () => {
      command.preloadRoute(href, { preloadData: true })
      return command.preloadData?.()
    },
  })

  if (command.priority === 'viewport') {
    flushScheduledNavigationPrefetches()
  }
}

export function prefetchProcessIntent(command: PrefetchProcessIntentCommand): void {
  if (!command.preloadData) {
    scheduleIntentPrefetch({
      processId: command.processId,
      preloadRoute: command.preloadRoute,
    })
    return
  }

  const preloadData = command.preloadData

  scheduleIntentPrefetch({
    processId: command.processId,
    preloadRoute: command.preloadRoute,
    preloadData: (processId: string) => {
      if (processId !== command.processId) return undefined
      return preloadData()
    },
  })
}

export function prefetchDashboardIntent(command: PrefetchDashboardIntentCommand): void {
  scheduleDashboardPrefetch({
    preloadRoute: command.preloadRoute,
    priority: 'intent',
    ...(command.preloadData ? { preloadData: command.preloadData } : {}),
  })
}
