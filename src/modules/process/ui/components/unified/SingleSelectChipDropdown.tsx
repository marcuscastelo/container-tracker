import type { JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'
import { ChevronDownIcon } from '~/modules/process/ui/components/unified/Icons'
import { SingleSelectOptionsList } from '~/modules/process/ui/components/unified/SingleSelectOptionsList'
import { useMotionOpenState } from '~/shared/ui/motion/useMotionOpenState'

export function SingleSelectChipDropdown<T extends string>(props: {
  readonly label: string
  readonly allLabel: string
  readonly testId: string
  readonly selectedValue: T | null
  readonly options: readonly FilterControlOption<T>[]
  readonly onSelect: (value: T | null) => void
  readonly toOptionLabel: (value: T) => string
}): JSX.Element {
  const hasSelection = () => props.selectedValue !== null

  const chipLabel = () => {
    if (!hasSelection()) return props.label
    const selected = props.options.find((o) => o.value === props.selectedValue)
    return selected ? `${props.label}: ${selected.label}` : props.label
  }

  const handleSelect = (value: T | null) => {
    props.onSelect(value)
    dropdown.close()
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
        class="motion-dropdown-panel absolute left-0 top-full z-20 mt-1 min-w-50 overflow-hidden rounded-md border border-control-border bg-control-popover shadow-lg"
      >
        <SingleSelectOptionsList
          allLabel={props.allLabel}
          selectedValue={props.selectedValue}
          options={props.options}
          onSelect={handleSelect}
        />
      </div>
    </div>
  )
}
