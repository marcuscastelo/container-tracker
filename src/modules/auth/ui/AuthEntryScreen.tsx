import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

export type AuthEntryScreenState = 'loading' | 'ready' | 'error'

type AuthEntryScreenProps = {
  readonly title: string
  readonly subtitle: string
  readonly primaryLabel: string
  readonly secondaryLabel: string
  readonly loadingLabel: string
  readonly secondaryHref: string
  readonly state: AuthEntryScreenState
  readonly onPrimaryAction: () => void
  readonly errorMessage: string | null
}

export function AuthEntryScreen(props: AuthEntryScreenProps): JSX.Element {
  return (
    <main class="min-h-screen bg-surface text-foreground">
      <div class="mx-auto flex min-h-screen w-full max-w-[460px] items-center justify-center px-6 py-10">
        <section class="w-full rounded-2xl border border-border bg-surface-muted p-8 shadow-sm">
          <p class="text-xs-ui font-semibold uppercase tracking-[0.18em] text-text-muted">
            Container Tracker
          </p>
          <h1 class="mt-3 text-2xl-ui font-semibold text-foreground">{props.title}</h1>
          <p class="mt-2 text-sm-ui text-text-muted">{props.subtitle}</p>

          <Show when={props.state === 'error' && props.errorMessage !== null}>
            <div
              class="mt-5 rounded-lg border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-sm-ui text-tone-danger-fg"
              role="alert"
            >
              {props.errorMessage}
            </div>
          </Show>

          <div class="mt-6 flex flex-col gap-3">
            <button
              type="button"
              class="motion-focus-surface motion-interactive inline-flex h-11 items-center justify-center rounded-lg border border-control-border bg-control-bg px-4 text-sm-ui font-semibold text-control-foreground hover:bg-control-bg-hover hover:text-control-foreground-strong disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => props.onPrimaryAction()}
              disabled={props.state === 'loading'}
            >
              <Show when={props.state === 'loading'} fallback={props.primaryLabel}>
                {props.loadingLabel}
              </Show>
            </button>

            <A
              href={props.secondaryHref}
              class="motion-focus-surface inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm-ui font-medium text-text-muted hover:bg-surface-hover hover:text-foreground"
            >
              {props.secondaryLabel}
            </A>
          </div>
        </section>
      </div>
    </main>
  )
}
