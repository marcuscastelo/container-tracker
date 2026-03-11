import type { JSX } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'
import { ChevronDownIcon } from '~/modules/process/ui/components/unified/Icons'
import { MultiSelectOptionsList } from '~/modules/process/ui/components/unified/MultiSelectOptionsList'

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

  let detailsRef: HTMLDetailsElement | undefined

  onMount(() => {
    const onDocClick: EventListener = (ev) => {
      if (!detailsRef) return
      if (!detailsRef.open) return
      const target = ev.target
      if (target instanceof Node && detailsRef.contains(target)) return
      detailsRef.open = false
    }

    const onOtherOpened: EventListener = (ev) => {
      if (!detailsRef) return
      if (!(ev instanceof CustomEvent)) return
      if (ev.detail !== detailsRef) {
        detailsRef.open = false
      }
    }

    const onToggle: EventListener = () => {
      if (!detailsRef) return
      if (detailsRef.open) {
        window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: detailsRef }))
      }
    }

    document.addEventListener('click', onDocClick)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)
    detailsRef?.addEventListener('toggle', onToggle)

    onCleanup(() => {
      document.removeEventListener('click', onDocClick)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
      detailsRef?.removeEventListener('toggle', onToggle)
    })
  })

  return (
    <details
      ref={(el) => {
        if (el instanceof HTMLDetailsElement) detailsRef = el
        else detailsRef = undefined
      }}
      class="group relative"
      data-testid={props.testId}
    >
      <summary
        class={`inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-md-ui transition-colors select-none ${
          hasSelection()
            ? 'border-control-selected-border bg-control-selected-bg text-control-selected-foreground'
            : 'border-control-border bg-control-bg text-control-foreground hover:border-control-border-hover hover:bg-control-bg-hover hover:text-control-foreground-strong'
        }`}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </summary>

      <div class="absolute left-0 top-full z-20 mt-1 min-w-55 overflow-hidden rounded-md border border-control-border bg-control-popover shadow-lg">
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
    </details>
  )
}
