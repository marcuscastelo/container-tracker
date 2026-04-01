export type PrefetchPriority = 'intent' | 'viewport'

type NavigationPrefetchTask = {
  readonly key: string
  readonly priority: PrefetchPriority
  readonly run: () => Promise<unknown> | unknown
}

type ScheduledNavigationPrefetchTask = Pick<NavigationPrefetchTask, 'priority' | 'run'>

type ViewportPrefetchControllerCommand<TKey extends string> = {
  readonly debounceMs?: number
  readonly collectVisibleKeys: () => readonly TKey[]
  readonly onVisibleKeysSettled: (keys: readonly TKey[]) => void
}

type ViewportPrefetchController = {
  readonly schedule: () => void
  readonly flush: () => void
  readonly dispose: () => void
}

const DEFAULT_VIEWPORT_PREFETCH_DEBOUNCE_MS = 180

const PREFETCH_PRIORITY_WEIGHT: Record<PrefetchPriority, number> = {
  intent: 0,
  viewport: 1,
}

const scheduledPrefetches = new Map<string, ScheduledNavigationPrefetchTask>()
const inFlightPrefetches = new Map<string, Promise<void>>()

let flushQueued = false

function shouldReplaceScheduledTask(
  currentTask: ScheduledNavigationPrefetchTask | undefined,
  nextTask: NavigationPrefetchTask,
): boolean {
  if (currentTask === undefined) return true

  const nextPriorityWeight = PREFETCH_PRIORITY_WEIGHT[nextTask.priority]
  const currentPriorityWeight = PREFETCH_PRIORITY_WEIGHT[currentTask.priority]

  if (nextPriorityWeight < currentPriorityWeight) return true
  if (nextPriorityWeight > currentPriorityWeight) return false

  return true
}

function clearQueuedFlushFlag(): void {
  flushQueued = false
}

function flushScheduledNavigationPrefetchesImpl(
  onlyPriorities?: readonly PrefetchPriority[],
): void {
  clearQueuedFlushFlag()

  const scheduledEntries = [...scheduledPrefetches.entries()].sort((left, right) => {
    const leftWeight = PREFETCH_PRIORITY_WEIGHT[left[1].priority]
    const rightWeight = PREFETCH_PRIORITY_WEIGHT[right[1].priority]
    return leftWeight - rightWeight
  })

  for (const [key, task] of scheduledEntries) {
    if (onlyPriorities && !onlyPriorities.includes(task.priority)) continue
    if (inFlightPrefetches.has(key)) continue

    scheduledPrefetches.delete(key)

    const request = Promise.resolve()
      .then(task.run)
      .then(() => undefined)
      .catch(() => {
        // Prefetch is best-effort and must never block navigation.
      })
      .finally(() => {
        inFlightPrefetches.delete(key)
      })

    inFlightPrefetches.set(key, request)
  }
}

function queueNavigationPrefetchFlush(): void {
  if (flushQueued) return

  flushQueued = true
  queueMicrotask(() => {
    flushScheduledNavigationPrefetchesImpl(['intent'])
  })
}

function toUniqueVisibleKeys<TKey extends string>(keys: readonly TKey[]): readonly TKey[] {
  const uniqueKeys = new Set<TKey>()

  for (const key of keys) {
    if (key.trim().length === 0) continue
    uniqueKeys.add(key)
  }

  return [...uniqueKeys]
}

export function scheduleNavigationPrefetch(task: NavigationPrefetchTask): void {
  if (task.key.trim().length === 0) return
  if (inFlightPrefetches.has(task.key)) return

  const currentTask = scheduledPrefetches.get(task.key)
  if (!shouldReplaceScheduledTask(currentTask, task)) return

  scheduledPrefetches.set(task.key, {
    priority: task.priority,
    run: task.run,
  })

  if (task.priority === 'intent') {
    queueNavigationPrefetchFlush()
  }
}

export function flushScheduledNavigationPrefetches(): void {
  flushScheduledNavigationPrefetchesImpl()
}

export function createViewportPrefetchController<TKey extends string>(
  command: ViewportPrefetchControllerCommand<TKey>,
): ViewportPrefetchController {
  const debounceMs = command.debounceMs ?? DEFAULT_VIEWPORT_PREFETCH_DEBOUNCE_MS

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const clearScheduledFlush = (): void => {
    if (timeoutId === null) return
    clearTimeout(timeoutId)
    timeoutId = null
  }

  const flush = (): void => {
    clearScheduledFlush()

    const visibleKeys = toUniqueVisibleKeys(command.collectVisibleKeys())
    if (visibleKeys.length === 0) return

    command.onVisibleKeysSettled(visibleKeys)
  }

  const schedule = (): void => {
    clearScheduledFlush()
    timeoutId = setTimeout(() => {
      flush()
    }, debounceMs)
  }

  return {
    schedule,
    flush,
    dispose: clearScheduledFlush,
  }
}

export async function waitForNavigationPrefetchesToSettleForTests(): Promise<void> {
  await Promise.allSettled(inFlightPrefetches.values())
}

export function resetNavigationPrefetchSchedulerForTests(): void {
  clearQueuedFlushFlag()
  scheduledPrefetches.clear()
  inFlightPrefetches.clear()
}
