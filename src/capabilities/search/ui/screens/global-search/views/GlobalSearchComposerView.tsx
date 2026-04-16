import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { SearchIcon } from '~/capabilities/search/ui/SearchOverlay.icons'
import type { GlobalSearchFilterChipVM } from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'

type GlobalSearchComposerViewProps = {
  readonly chips: readonly GlobalSearchFilterChipVM[]
  readonly draft: string
  readonly placeholder: string
  readonly clearLabel: string
  readonly onDraftInput: (value: string) => void
  readonly onKeyDown: (event: KeyboardEvent) => void
  readonly onRemoveChip: (index: number) => void
  readonly onClear: () => void
  readonly setInputRef: (element: HTMLInputElement) => void
  readonly expanded: boolean
  readonly listboxId: string | undefined
  readonly activeDescendantId: string | undefined
}

export function GlobalSearchComposerView(props: GlobalSearchComposerViewProps): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-2 border-b border-control-border px-4 py-3">
      <SearchIcon />

      <For each={props.chips}>
        {(chip, index) => (
          <span class="flex items-center gap-2 rounded-full border border-control-border bg-control-bg-hover px-3 py-1 text-xs-ui text-control-foreground">
            <span>{chip.label}</span>
            <button
              type="button"
              onClick={() => props.onRemoveChip(index())}
              class="motion-focus-surface motion-interactive rounded text-text-muted hover:text-control-foreground"
              aria-label={chip.label}
            >
              ×
            </button>
          </span>
        )}
      </For>

      <input
        ref={(element) => props.setInputRef(element)}
        type="text"
        value={props.draft}
        onInput={(event) => props.onDraftInput(event.currentTarget.value)}
        onKeyDown={(event) => props.onKeyDown(event)}
        placeholder={props.placeholder}
        class="motion-focus-surface min-w-[12rem] flex-1 rounded-md bg-transparent px-1 py-1 text-sm-ui text-control-popover-foreground placeholder:text-control-placeholder outline-none"
        autocomplete="off"
        spellcheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={props.expanded}
        aria-haspopup="listbox"
        aria-controls={props.listboxId}
        aria-activedescendant={props.activeDescendantId}
      />

      <button
        type="button"
        onClick={() => props.onClear()}
        class="motion-focus-surface motion-interactive rounded p-0.5 text-control-foreground hover:text-control-foreground-strong"
        aria-label={props.clearLabel}
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <kbd class="rounded border border-control-border bg-control-bg-hover px-1.5 py-0.5 text-xs-ui text-control-foreground">
        Esc
      </kbd>
    </div>
  )
}
