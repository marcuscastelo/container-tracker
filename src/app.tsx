import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Suspense } from 'solid-js'
import { Nav } from '~/components/Nav'
import './app.css'

export default function App() {
  return (
    <Router
      root={(props) => (
        // The `root` div with class "root" enables isolation for BaseUI Portals (see app.css)
        <div class="root">
          <Nav />
          <Suspense>{props.children}</Suspense>
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
