import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

type Props = {
  readonly title: string
  readonly subtitle?: string
  readonly lastRefreshed: string
  readonly isLive: boolean
  readonly onRefresh: () => void
}

function LiveIndicator(): JSX.Element {
  return (
    <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs-ui font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-500/20">
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  )
}

export function AgentPageHeader(props: Props): JSX.Element {
  return (
    <section class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-3">
          <h1 class="text-lg-ui font-semibold text-slate-900">{props.title}</h1>
          <Show when={props.isLive}>
            <LiveIndicator />
          </Show>
        </div>
        <Show when={props.subtitle}>
          <p class="text-sm-ui text-slate-500">{props.subtitle}</p>
        </Show>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-micro text-slate-400">Updated {props.lastRefreshed}</span>
        <button
          type="button"
          onClick={() => props.onRefresh()}
          class="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-sm-ui font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <svg
            class="h-3.5 w-3.5"
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
