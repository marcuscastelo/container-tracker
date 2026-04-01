import { A } from '@solidjs/router'

export default function NotFoundPage() {
  return (
    <main class="p-6 text-center">
      <h1>404</h1>
      <p>Page not found.</p>
      <p>
        <A href="/">Go back home</A>
      </p>
    </main>
  )
}
