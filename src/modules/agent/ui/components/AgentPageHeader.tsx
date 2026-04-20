import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

type Props = {
  readonly title: string
  readonly subtitle?: string
  readonly lastRefreshed: string
  readonly isLive: boolean
  readonly refreshing?: boolean
  readonly onRefresh: () => void
}

function LiveIndicator(): JSX.Element {
  return (
    <span class="inline-flex items-center gap-1.5 rounded-full bg-tone-success-bg px-2.5 py-0.5 text-xs-ui font-semibold text-tone-success-fg ring-1 ring-inset ring-tone-success-border/40">
      <span class="inline-flex h-2 w-2 rounded-full bg-tone-success-strong shadow-[0_0_0_3px_rgb(34_197_94_/0.18)]" />
      Live
    </span>
  )
}

export function AgentPageHeader(props: Props): JSX.Element {
  return (
    <section class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-3">
          <h1 class="text-lg-ui font-semibold text-foreground">{props.title}</h1>
          <Show when={props.isLive}>
            <LiveIndicator />
          </Show>
        </div>
        <Show when={props.subtitle}>
          <p class="text-sm-ui text-text-muted">{props.subtitle}</p>
        </Show>
      </div>
      <div class="flex items-center gap-3">
        <Show when={props.refreshing === true}>
          <span class="text-micro text-text-muted">Refreshing...</span>
        </Show>
        <span class="text-micro text-text-muted">Updated {props.lastRefreshed}</span>
        <button
          type="button"
          onClick={() => props.onRefresh()}
          class="motion-focus-surface motion-interactive inline-flex items-center gap-1.5 rounded border border-control-border bg-control-bg px-2.5 py-1 text-sm-ui font-medium text-control-foreground hover:border-control-border-hover hover:bg-control-bg-hover hover:text-control-foreground-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <svg
            class={`h-3.5 w-3.5 ${props.refreshing === true ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>
    </section>
  )
}
