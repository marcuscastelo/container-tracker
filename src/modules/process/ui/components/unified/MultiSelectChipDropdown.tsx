import type { JSX } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'
import { ChevronDownIcon } from '~/modules/process/ui/components/unified/Icons'
import { MultiSelectOptionsList } from '~/modules/process/ui/components/unified/MultiSelectOptionsList'
import { useMotionOpenState } from '~/shared/ui/motion/useMotionOpenState'

export function MultiSelectChipDropdown<T extends string>(props: {
  readonly label: string
  readonly allLabel: string
  readonly emptyLabel: string
  readonly testId: string
  readonly selectedValues: readonly T[]
  readonly options: readonly FilterControlOption<T>[]
  readonly onToggle: (value: T) => void
  readonly toSelectedCountLabel: (count: number) => string
}): JSX.Element {
  const selectedCount = () => props.selectedValues.length
  const isSelected = (value: T): boolean => props.selectedValues.some((v) => v === value)

  const hasSelection = () => selectedCount() > 0

  const chipLabel = () => {
    if (props.options.length === 0) return props.label
    if (!hasSelection()) return props.label
    if (selectedCount() === 1) {
      const selected = props.options.find((o) => isSelected(o.value))
      return selected ? `${props.label}: ${selected.label}` : props.label
    }
    return `${props.label}: ${props.toSelectedCountLabel(selectedCount())}`
  }

  const dropdown = useMotionOpenState()
  let rootRef: HTMLDivElement | undefined

  onMount(() => {
    const onDocClick: EventListener = (ev) => {
      if (!dropdown.isOpen()) return
      const target = ev.target
      if (target instanceof Node && rootRef?.contains(target)) return
      dropdown.close()
    }

    const onOtherOpened: EventListener = (ev) => {
      if (!rootRef) return
      if (!(ev instanceof CustomEvent)) return
      if (ev.detail !== rootRef) {
        dropdown.close()
      }
    }

    document.addEventListener('click', onDocClick)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)

    onCleanup(() => {
      document.removeEventListener('click', onDocClick)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
    })
  })

  return (
    <div
      ref={(el) => {
        if (el instanceof HTMLDivElement) rootRef = el
        else rootRef = undefined
      }}
      class="group relative"
      data-testid={props.testId}
      data-state={dropdown.panelState()}
    >
      <button
        type="button"
        aria-expanded={dropdown.isOpen()}
        class={`motion-focus-surface motion-interactive inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-md-ui select-none ${
          hasSelection()
            ? 'border-control-selected-border bg-control-selected-bg text-control-selected-foreground'
            : 'border-control-border bg-control-bg text-control-foreground hover:border-control-border-hover hover:bg-control-bg-hover hover:text-control-foreground-strong'
        }`}
        onClick={() => {
          if (dropdown.isOpen()) {
            dropdown.close()
            return
          }

          dropdown.open()
          if (rootRef) {
            window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: rootRef }))
          }
        }}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </button>

      <div
        data-state={dropdown.panelState()}
        class="motion-dropdown-panel absolute left-0 top-full z-20 mt-1 min-w-55 overflow-hidden rounded-md border border-control-border bg-control-popover shadow-lg"
      >
        <Show
          when={props.options.length === 0}
          fallback={
            <MultiSelectOptionsList
              options={props.options}
              isSelected={isSelected}
              onToggle={props.onToggle}
            />
          }
        >
          <p class="px-3 py-2 text-md-ui text-text-muted">{props.emptyLabel}</p>
        </Show>
      </div>
    </div>
  )
}
