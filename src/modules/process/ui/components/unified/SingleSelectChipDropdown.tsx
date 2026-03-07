import type { JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'
import { ChevronDownIcon } from '~/modules/process/ui/components/unified/Icons'
import { SingleSelectOptionsList } from '~/modules/process/ui/components/unified/SingleSelectOptionsList'

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
    // close this dropdown after selection
    if (detailsRef) detailsRef.open = false
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
            ? 'border-slate-400 bg-slate-50 text-slate-800'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
        }`}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </summary>

      <div class="absolute left-0 top-full z-20 mt-1 min-w-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <SingleSelectOptionsList
          allLabel={props.allLabel}
          selectedValue={props.selectedValue}
          options={props.options}
          onSelect={handleSelect}
        />
      </div>
    </details>
  )
}
