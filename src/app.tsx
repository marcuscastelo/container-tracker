import { Router, usePreloadRoute } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, ErrorBoundary, Show, Suspense } from 'solid-js'
import { Toaster } from 'solid-toast'
import { getAppErrorDetails } from '~/app-error-details'
import { AppInitialRoutePrefetchBoundary } from '~/modules/process/ui/screens/app/AppInitialRoutePrefetchBoundary'
import { AppRouteSkeleton } from '~/modules/process/ui/screens/app/AppRouteSkeleton'
import { DashboardKeepWarmBoundary } from '~/modules/process/ui/screens/dashboard/DashboardKeepWarmBoundary'
import {
  dismissServerProblemBanner,
  useServerProblemBanner,
} from '~/shared/api/httpDegradationReporter'
import { ensureWorkosAuthenticated, isWorkosAuthConfigured } from '~/shared/auth/workos-auth.client'
import { useTranslation } from '~/shared/localization/i18n'
import '~/app.css'

type AppErrorBoundaryFallbackProps = {
  readonly error: unknown
}

type AppRouterRootProps = {
  readonly children: JSX.Element
  readonly location: {
    readonly pathname: string
  }
}

function isPublicAuthRoute(pathname: string): boolean {
  return pathname === '/auth/login' || pathname === '/auth/callback' || pathname === '/auth/logout'
}

function AppErrorBoundaryFallback(props: AppErrorBoundaryFallbackProps): JSX.Element {
  const { t, keys } = useTranslation()
  const details = createMemo(() => getAppErrorDetails(props.error, import.meta.env?.DEV === true))

  createEffect(() => {
    try {
      console.error('Uncaught render error in App root:', props.error)
    } catch (_error) {}
  })

  return (
    <div style={{ padding: '24px' }}>
      <h1>Something went wrong.</h1>
      <p>{t(keys.app.unexpectedRenderError)}</p>
      <Show when={details()}>
        {(value) => (
          <pre style={{ 'margin-top': '12px', 'white-space': 'pre-wrap' }}>{value()}</pre>
        )}
      </Show>
    </div>
  )
}

function GlobalServerProblemBanner(): JSX.Element {
  const { t, keys } = useTranslation()
  const bannerState = useServerProblemBanner()

  return (
    <Show when={bannerState().visible}>
      <div class="border-b border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg">
        <div class="mx-auto flex max-w-(--dashboard-container-max-width) items-start justify-between gap-4 px-[var(--dashboard-container-px)] py-2.5 text-sm-ui">
          <p class="font-medium">{t(keys.app.serverProblemBanner)}</p>
          <button
            type="button"
            class="shrink-0 text-sm-ui font-medium underline underline-offset-2"
            onClick={() => dismissServerProblemBanner()}
          >
            {t(keys.app.dismissServerProblemBanner)}
          </button>
        </div>
      </div>
    </Show>
  )
}

function AppRouterRoot(props: AppRouterRootProps): JSX.Element {
  const preloadRoute = usePreloadRoute()
  const { locale } = useTranslation()

  createEffect(() => {
    const pathname = props.location.pathname
    if (isPublicAuthRoute(pathname)) return

    if (!isWorkosAuthConfigured()) {
      console.error('WorkOS AuthKit is not configured. Set VITE_PUBLIC_WORKOS_CLIENT_ID.')
      return
    }

    void ensureWorkosAuthenticated(pathname)
  })

  return (
    <div class="root">
      <AppInitialRoutePrefetchBoundary pathname={() => props.location.pathname} locale={locale} />
      <DashboardKeepWarmBoundary
        pathname={() => props.location.pathname}
        preloadRoute={preloadRoute}
      />
      <GlobalServerProblemBanner />
      <ErrorBoundary fallback={(err) => <AppErrorBoundaryFallback error={err} />}>
        <Suspense fallback={<AppRouteSkeleton pathname={() => props.location.pathname} />}>
          {props.children}
        </Suspense>
      </ErrorBoundary>
      <Toaster position="top-right" />
    </div>
  )
}

/** @public */
export default function App() {
  return (
    <Router root={(props) => <AppRouterRoot {...props}>{props.children}</AppRouterRoot>}>
      <FileRoutes />
    </Router>
  )
}
