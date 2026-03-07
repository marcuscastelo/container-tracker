import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { FilterControlOption } from './FilterControlOption'
import { ChevronDownIcon } from './Icons'

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

  const handleSelect = (
    event: MouseEvent & { readonly currentTarget: HTMLElement },
    value: T | null,
  ) => {
    props.onSelect(value)
    const detailsElement = event.currentTarget.closest('details')
    if (detailsElement instanceof HTMLDetailsElement) {
      detailsElement.open = false
    }
  }

  return (
    <details class="group relative" data-testid={props.testId}>
      <summary
        class={`inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors select-none ${
          hasSelection()
            ? 'border-slate-400 bg-slate-50 text-slate-800'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
        }`}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </summary>

      <div class="absolute left-0 top-full z-20 mt-1 min-w-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <ul class="max-h-56 overflow-y-auto p-1">
          <li
            role="button"
            tabIndex={0}
            class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
              hasSelection() ? 'text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-800'
            }`}
            onClick={(event) => handleSelect(event as any, null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelect(e as any, null)
            }}
          >
            <span class="min-w-0 flex-1 truncate">{props.allLabel}</span>
          </li>
          <For each={props.options}>
            {(option) => (
              <li
                role="button"
                tabIndex={0}
                class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
                  props.selectedValue === option.value
                    ? 'bg-slate-100 text-slate-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                onClick={(event) => handleSelect(event as any, option.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelect(e as any, option.value)
                }}
              >
                <span class="min-w-0 flex-1 truncate">{option.label}</span>
                <span class="shrink-0 tabular-nums text-[11px] text-slate-400">{option.count}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </details>
  )
}
