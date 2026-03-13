import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { SearchIcon } from '~/capabilities/search/ui/SearchOverlay.icons'

type SearchTriggerButtonProps = {
  readonly placeholder: string
  readonly shortcutLabel: string
  readonly onOpen: () => void
}

export function SearchTriggerButton(props: SearchTriggerButtonProps): JSX.Element {
  const [isFocused, setIsFocused] = createSignal(false)

  return (
    <button
      type="button"
      data-search-trigger="true"
      onClick={() => props.onOpen()}
      onFocusIn={() => setIsFocused(true)}
      onFocusOut={() => setIsFocused(false)}
      class="group relative flex w-full items-center gap-2 rounded-md border border-control-border bg-control-bg px-3 pr-12 text-left transition-colors hover:border-control-border-hover hover:bg-control-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{ height: 'var(--dashboard-search-height)' }}
    >
      <SearchIcon />
      <span class="flex-1 truncate text-sm-ui text-control-foreground">{props.placeholder}</span>
      <span
        class={`pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 transition-opacity sm:inline-block ${
          isFocused() ? 'opacity-0' : 'opacity-80'
        }`}
        aria-hidden="true"
      >
        <kbd class="rounded border border-border bg-surface-muted/50 px-1.5 py-0.5 font-mono text-xs-ui text-text-muted">
          {props.shortcutLabel}
        </kbd>
      </span>
    </button>
  )
}
