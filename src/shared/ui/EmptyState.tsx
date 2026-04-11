import { type JSX, Show } from 'solid-js'

type Props = {
  readonly title: string
  readonly description: string
  readonly actionLabel?: string
  readonly onAction?: () => void
}

export function EmptyState(props: Props): JSX.Element {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
        <svg
          class="h-8 w-8 text-text-muted"
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
      <h3 class="mb-2 text-lg-ui font-semibold text-foreground">{props.title}</h3>
      <p class="mb-6 max-w-sm text-md-ui text-text-muted">{props.description}</p>
      <Show when={props.actionLabel}>
        {(actionLabel) => (
          <Show when={props.onAction} keyed>
            {(onAction) => (
              <button
                type="button"
                onClick={() => onAction()}
                class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm-ui font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {actionLabel()}
              </button>
            )}
          </Show>
        )}
      </Show>
    </div>
  )
}
