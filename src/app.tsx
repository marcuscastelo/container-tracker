import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { ErrorBoundary, Suspense } from 'solid-js'
import { Toaster } from 'solid-toast'
import '~/app.css'

/** @public */
export default function App() {
  return (
    <Router
      root={(props) => (
        // The `root` div with class "root" enables isolation for BaseUI Portals (see app.css)
        <div class="root">
          <ErrorBoundary
            fallback={(err) => {
              try {
                console.error('Uncaught render error in App root:', err)
              } catch (_e) {}
              return (
                <div style={{ padding: '24px' }}>
                  <h1>Something went wrong.</h1>
                  <p>{err instanceof Error ? err.message : String(err)}</p>
                </div>
              )
            }}
          >
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
          <Toaster position="top-right" />
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
