// @refresh reload
import '~/shared/localization/i18n'
import { mount, StartClient } from '@solidjs/start/client'
import { render } from 'solid-js/web'
import { initializeTheme } from '~/lib/theme'
import { env } from '~/shared/config/env'

type DisposeFn = () => void

type ClientRuntimeState = {
  disposeApp?: DisposeFn
  disposeGlobalHandlers?: DisposeFn
}

const CLIENT_RUNTIME_KEY = '__ctClientRuntime'

// Load env on the client bundle as well so the app has consistent config
void env

initializeTheme()

function installGlobalErrorHandlers(): DisposeFn {
  const onWindowError = (ev: ErrorEvent) => {
    try {
      // ev.error may be undefined for some browser errors
      console.error('global error captured in entry-client', ev.error ?? ev.message ?? ev)
    } catch (err) {
      // fallback noop
      console.error('failed to log global error', err)
    }
  }

  const onWindowUnhandledRejection = (ev: PromiseRejectionEvent) => {
    try {
      console.error('unhandledrejection captured in entry-client', ev.reason)
    } catch (err) {
      console.error('failed to log unhandledrejection', err)
    }
  }

  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onWindowUnhandledRejection)

  return () => {
    window.removeEventListener('error', onWindowError)
    window.removeEventListener('unhandledrejection', onWindowUnhandledRejection)
  }
}

function isDisposeFn(value: unknown): value is DisposeFn {
  return typeof value === 'function'
}

function isClientRuntimeState(value: unknown): value is ClientRuntimeState {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const disposeApp = Reflect.get(value, 'disposeApp')
  if (disposeApp !== undefined && !isDisposeFn(disposeApp)) {
    return false
  }

  const disposeGlobalHandlers = Reflect.get(value, 'disposeGlobalHandlers')
  if (disposeGlobalHandlers !== undefined && !isDisposeFn(disposeGlobalHandlers)) {
    return false
  }

  return true
}

function readClientRuntimeState(): ClientRuntimeState | null {
  const runtime = Reflect.get(window, CLIENT_RUNTIME_KEY)
  return isClientRuntimeState(runtime) ? runtime : null
}

function getClientRuntimeState(): ClientRuntimeState | null {
  if (typeof window === 'undefined') {
    return null
  }

  const existingRuntime = readClientRuntimeState()
  if (existingRuntime) {
    return existingRuntime
  }

  const runtime: ClientRuntimeState = {}
  Reflect.set(window, CLIENT_RUNTIME_KEY, runtime)
  return runtime
}

function disposeRuntime(runtime: ClientRuntimeState): void {
  runtime.disposeApp?.()
  runtime.disposeGlobalHandlers?.()
  runtime.disposeApp = undefined
  runtime.disposeGlobalHandlers = undefined
}

function mountClientApp(root: HTMLElement): DisposeFn {
  // In HMR we always remount with render so we get a disposer and never stack roots.
  if (import.meta.hot) {
    root.replaceChildren()
    return render(() => <StartClient />, root)
  }

  const hydrated = mount(() => <StartClient />, root)
  return isDisposeFn(hydrated) ? hydrated : () => {}
}

// TODO: Remove global error handlers once we have better visibility into client-side issues and confidence they won't fail silently. See
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/31
// Install global error handlers early so any silent failures are visible in the console

try {
  const runtime = getClientRuntimeState()
  if (runtime === null) {
    throw new Error('entry-client: window is not available during client bootstrap')
  }

  const root = document.getElementById('app')
  if (root) {
    disposeRuntime(runtime)

    const disposeGlobalHandlers = installGlobalErrorHandlers()
    const disposeApp = mountClientApp(root)

    runtime.disposeGlobalHandlers = disposeGlobalHandlers
    runtime.disposeApp = disposeApp

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        disposeApp()
        disposeGlobalHandlers()

        if (runtime.disposeApp === disposeApp) {
          runtime.disposeApp = undefined
        }
        if (runtime.disposeGlobalHandlers === disposeGlobalHandlers) {
          runtime.disposeGlobalHandlers = undefined
        }
      })
    }
  } else {
    console.error('entry-client: #app root element not found — mount aborted')
  }
} catch (err) {
  console.error('entry-client: mount failed', err)
}
