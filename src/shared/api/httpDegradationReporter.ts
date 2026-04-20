import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'

type HttpFailureReport = {
  readonly status?: number
  readonly error?: unknown
}

export type ServerProblemBannerState = {
  readonly visible: boolean
}

type ServerProblemBannerListener = (state: ServerProblemBannerState) => void

const serverProblemBannerState = {
  visible: false,
  dismissed: false,
}

const listeners = new Set<ServerProblemBannerListener>()

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined'
}

function readSnapshot(): ServerProblemBannerState {
  return {
    visible: serverProblemBannerState.visible,
  }
}

function publishServerProblemBannerState(): void {
  const snapshot = readSnapshot()
  for (const listener of listeners) {
    listener(snapshot)
  }
}

function shouldReportServerFailure(report: HttpFailureReport): boolean {
  if (typeof report.status === 'number') {
    return report.status >= 500
  }

  return report.error !== undefined
}

export function readServerProblemBannerState(): ServerProblemBannerState {
  return readSnapshot()
}

export function subscribeToServerProblemBanner(listener: ServerProblemBannerListener): () => void {
  listeners.add(listener)
  listener(readSnapshot())

  return () => {
    listeners.delete(listener)
  }
}

export function reportHttpFailure(report: HttpFailureReport): void {
  if (!isBrowserRuntime()) return
  if (!shouldReportServerFailure(report)) return
  if (serverProblemBannerState.visible || serverProblemBannerState.dismissed) return

  serverProblemBannerState.visible = true
  publishServerProblemBannerState()
}

export function reportHttpSuccess(): void {
  if (!isBrowserRuntime()) return
  if (!serverProblemBannerState.dismissed) return

  serverProblemBannerState.dismissed = false
}

export function dismissServerProblemBanner(): void {
  if (!isBrowserRuntime()) return
  if (!serverProblemBannerState.visible) return

  serverProblemBannerState.visible = false
  serverProblemBannerState.dismissed = true
  publishServerProblemBannerState()
}

export async function fetchWithHttpDegradationReporting(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(input, init)

    if (response.ok) {
      reportHttpSuccess()
    } else {
      reportHttpFailure({ status: response.status })
    }

    return response
  } catch (error) {
    reportHttpFailure({ error })
    throw error
  }
}

export function useServerProblemBanner(): Accessor<ServerProblemBannerState> {
  const [state, setState] = createSignal<ServerProblemBannerState>(readSnapshot())

  createEffect(() => {
    if (!isBrowserRuntime()) return

    const unsubscribe = subscribeToServerProblemBanner((nextState) => {
      setState(() => nextState)
    })

    onCleanup(() => {
      unsubscribe()
    })
  })

  return state
}

export function resetServerProblemBannerForTests(): void {
  serverProblemBannerState.visible = false
  serverProblemBannerState.dismissed = false
  listeners.clear()
}
