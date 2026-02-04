import type { JSX } from 'solid-js'

type Props = {
  readonly title: string
  readonly description: string
  readonly actionLabel?: string
  readonly onAction?: () => void
}

export function EmptyState(props: Props): JSX.Element {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <svg
          class="h-8 w-8 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <h3 class="mb-2 text-lg font-semibold text-slate-900">{props.title}</h3>
      <p class="mb-6 max-w-sm text-sm text-slate-500">{props.description}</p>
      {props.actionLabel && props.onAction && (
        <button
          type="button"
          onClick={props.onAction}
          class="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          {props.actionLabel}
        </button>
      )}
    </div>
  )
}
