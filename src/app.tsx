import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { ErrorBoundary, Suspense } from 'solid-js'
import '~/app.css'

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
              } catch (_e) { }
              return (
                <div style={{ padding: '24px' }}>
                  An unexpected error occurred. Check the console for details.
                </div>
              )
            }}
          >
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
