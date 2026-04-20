import { A, useNavigate } from '@solidjs/router'
import { createSignal, onMount, Show } from 'solid-js'
import { startWorkosSignOut } from '~/shared/auth/workos-auth.client'
import { useTranslation } from '~/shared/localization/i18n'

export default function AuthLogoutRoute() {
  const navigate = useNavigate()
  const { t, keys } = useTranslation()
  const [state, setState] = createSignal<'loading' | 'error'>('loading')

  onMount(() => {
    void startWorkosSignOut('/')
      .then(() => navigate('/auth/login', { replace: true }))
      .catch((error: unknown) => {
        console.error('Auth logout failed', error)
        setState('error')
      })
  })

  return (
    <main class="min-h-screen bg-surface text-foreground">
      <div class="mx-auto flex min-h-screen w-full max-w-[460px] items-center justify-center px-6 py-10">
        <section class="w-full rounded-2xl border border-border bg-surface-muted p-8 shadow-sm">
          <Show when={state() === 'loading'} fallback={<p>{t(keys.auth.common.errorNetwork)}</p>}>
            <p>{t(keys.auth.common.loading)}</p>
          </Show>
          <Show when={state() === 'error'}>
            <A
              href="/auth/login"
              class="mt-4 inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-sm-ui text-text-muted hover:text-foreground"
            >
              {t(keys.auth.common.backToLogin)}
            </A>
          </Show>
        </section>
      </div>
    </main>
  )
}
